import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { campaignService } from '../services/campaignService';
import { characterService } from '../services/characterService';
import { diceService } from '../services/diceService';
import { challengeService } from '../services/challengeService';
import { useWebSocket } from '../hooks/useWebSocket';
import CharacterCard from '../components/CharacterCard';
import CreateCharacterModal from '../components/CreateCharacterModal';
import CreateChallengeModal from '../components/CreateChallengeModal';
import ChallengeList from '../components/ChallengeList';
import DicePoolModal from '../components/DicePoolModal';
import DiceRollModal from '../components/DiceRollModal';
import RollHistoryFeed from '../components/RollHistoryFeed';
import CampaignMembersPanel from '../components/CampaignMembersPanel';
import type { Campaign, Character, DicePool, ChallengeWithStats, PoolDie } from '../types';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [dicePools, setDicePools] = useState<Record<number, DicePool>>({});
  const [challenges, setChallenges] = useState<ChallengeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showCreateCharacterModal, setShowCreateCharacterModal] = useState(false);
  const [showCreateChallengeModal, setShowCreateChallengeModal] = useState(false);

  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // For dice rolling
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedDie, setSelectedDie] = useState<PoolDie | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeWithStats | null>(null);
  const [showDicePoolModal, setShowDicePoolModal] = useState(false);
  const [selectedCharacterForPool, setSelectedCharacterForPool] = useState<Character | null>(null);
  const [isEditingPool, setIsEditingPool] = useState(false);

  // WebSocket handlers
  const onWsRollComplete = useCallback((payload: any) => {
    console.log('Roll complete:', payload);
    // Trigger roll history refresh
    setRefreshCounter(prev => prev + 1);
    
    // Update the dice pool for this character to mark the die as used
    const characterId = payload.character_id;
    setDicePools(prev => {
      const pool = prev[characterId];
      if (!pool) return prev;
      
      return {
        ...prev,
        [characterId]: {
          ...pool,
          dice: pool.dice.map(die => 
            die.id === payload.roll?.pool_dice_id 
              ? { ...die, is_used: true }
              : die
          ),
        },
      };
    });
  }, []);

  const handleDicePoolUpdated = useCallback((payload: any) => {
    console.log('Dice pool updated:', payload);
    const { character_id, pool } = payload;
    setDicePools(prev => ({
      ...prev,
      [character_id]: pool,
    }));
  }, []);

  const handleChallengeUpdate = useCallback((payload: any) => {
    console.log('Challenge update:', payload);
    const { action, challenge } = payload;
    
    if (action === 'created') {
      // Add new challenge to the list
      setChallenges(prev => [{
        ...challenge,
        total_attempts: 0,
        successful_attempts: 0,
        failed_attempts: 0,
      }, ...prev]);
    } else if (action === 'completed') {
      // Remove completed challenge from active list
      setChallenges(prev => prev.filter(c => c.id !== challenge.id));
    }
  }, []);

  const handleDayIncremented = useCallback((payload: any) => {
    console.log('Day incremented:', payload);
    setCampaign(prev => prev ? {
      ...prev,
      current_day: payload.current_day,
    } : null);
    
    // Clear all dice pools since it's a new day
    setDicePools({});
  }, []);

  // Connect to WebSocket
  const { isConnected } = useWebSocket({
    campaignId: Number(id),
    onRollComplete: onWsRollComplete,
    onDicePoolUpdated: handleDicePoolUpdated,
    onChallengeUpdate: handleChallengeUpdate,
    onDayIncremented: handleDayIncremented,
  });

  useEffect(() => {
    if (id) {
      loadCampaignData();
    }
  }, [id]);

  const loadCampaignData = async () => {
    try {
      const [campaignData, charactersData, challengesData] = await Promise.all([
        campaignService.get(Number(id)),
        characterService.listByCampaign(Number(id)),
        challengeService.listByCampaign(Number(id)),
      ]);

      setCampaign(campaignData);
      
      const charactersArray = Array.isArray(charactersData) ? charactersData : [];
      setCharacters(charactersArray);
      
      setChallenges(challengesData);

      // Load dice pools for all characters
      const pools: Record<number, DicePool> = {};
      for (const char of charactersArray) {
        try {
          const pool = await diceService.getCurrentPool(char.id);
          pools[char.id] = pool;
        } catch (err) {
          console.log(`No pool for character ${char.id}`);
        }
      }
      setDicePools(pools);
    } catch (error) {
      console.error('Failed to load campaign:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIncrementDay = async () => {
    if (!campaign) return;
    try {
      const updated = await campaignService.incrementDay(campaign.id);
      setCampaign(updated);
      setDicePools({});
    } catch (error) {
      console.error('Failed to increment day:', error);
    }
  };

  const handleRollPool = async (characterId: number) => {
    const character = characters.find(c => c.id === characterId);
    if (character) {
      setSelectedCharacterForPool(character);
      setIsEditingPool(false);
      setShowDicePoolModal(true);
    }
  };

  const handleEditPool = (characterId: number) => {
    const character = characters.find(c => c.id === characterId);
    if (character) {
      setSelectedCharacterForPool(character);
      setIsEditingPool(true);
      setShowDicePoolModal(true);
    }
  }

  const handleDicePoolSuccess = (pool: DicePool) => {
    if (selectedCharacterForPool) {
      setDicePools((prev) => ({...prev, [selectedCharacterForPool.id]: pool }));
    }
    setShowDicePoolModal(false);
    setSelectedCharacterForPool(null);
    setIsEditingPool(false);
  }

  const handleAttemptChallenge = (challenge: ChallengeWithStats) => {
    // Find user's character
    const myCharacter = characters.find((c) => c.user_id === user?.id);
    if (!myCharacter) {
      alert('You need a character to attempt challenges!');
      return;
    }

    // Check if character has a dice pool
    const pool = dicePools[myCharacter.id];
    if (!pool || pool.dice.every((d) => d.is_used)) {
      alert('You need available dice to attempt this challenge!');
      return;
    }

    // Find first available die
    const availableDie = pool.dice.find((d) => !d.is_used);
    if (!availableDie) {
      alert('No available dice!');
      return;
    }

    // Set up for rolling with auto-selected die
    setSelectedChallenge(challenge);
    setSelectedCharacter(myCharacter);
    setSelectedDie(availableDie);
  };

  const handleCompleteChallenge = async (challengeId: number) => {
    try {
      await challengeService.complete(challengeId);
      // WebSocket will handle updating the challenges list
    } catch (error) {
      console.error('Failed to complete challenge:', error);
    }
  };

  const handleDieClick = (character: Character, die: PoolDie) => {
    if (die.is_used) return;
    
    setSelectedCharacter(character);
    setSelectedDie(die);
  };

  const handleModalSuccess = () => {
    setSelectedCharacter(null);
    setSelectedDie(null);
    setSelectedChallenge(null);
    // WebSocket will handle the refresh
  };

  const isGM = campaign && user && campaign.gm_user_id === user.id;
  const canManageCampaign = isGM || isAdmin();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Campaign not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/campaigns')}
                className="text-blue-600 hover:text-blue-800"
              >
                ← Back
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{campaign.name}</h1>
                  {/* WebSocket connection indicator */}
                  <span 
                    className={`inline-block w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    title={isConnected ? 'Connected' : 'Disconnected'}
                  />
                </div>
                <p className="text-gray-600">Day {campaign.current_day}</p>
              </div>
            </div>
            {isGM && (
              <button
                onClick={handleIncrementDay}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Next Day
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Challenges Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Active Challenges</h2>
                {isGM && (
                  <button
                    onClick={() => setShowCreateChallengeModal(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                  >
                    Create Challenge
                  </button>
                )}
              </div>
              <ChallengeList
                challenges={challenges}
                isGM={!!isGM}
                onAttemptChallenge={handleAttemptChallenge}
                onCompleteChallenge={handleCompleteChallenge}
              />
            </div>

            {/* Characters Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Characters</h2>
                <button
                  onClick={() => setShowCreateCharacterModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Create Character
                </button>
              </div>

              {characters.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <p className="text-gray-600">No characters yet. Create one to get started!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {characters.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      gmUserId={campaign.gm_user_id}
                      dicePool={dicePools[character.id]}
                      onRollPool={() => handleRollPool(character.id)}
                      onEditPool={() => handleEditPool(character.id)}
                      onViewDetails={() => navigate(`/characters/${character.id}`)}
                      onDieClick={(die) => handleDieClick(character, die)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Roll History Feed */}
            <RollHistoryFeed 
              campaignId={campaign.id} 
              refreshTrigger={refreshCounter}
            />

            {/* Campaign Members Panel - Only for GM or Admin */}
            {canManageCampaign && (
              <CampaignMembersPanel
                campaignId={campaign.id}
                gmUserId={campaign.gm_user_id}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateCharacterModal && (
        <CreateCharacterModal
          campaignId={campaign.id}
          gmUserId={campaign.gm_user_id}
          onClose={() => setShowCreateCharacterModal(false)}
          onSuccess={() => {
            setShowCreateCharacterModal(false);
            loadCampaignData();
          }}
        />
      )}

      {showCreateChallengeModal && (
        <CreateChallengeModal
          campaignId={campaign.id}
          onClose={() => setShowCreateChallengeModal(false)}
          onSuccess={() => {
            setShowCreateChallengeModal(false);
            // WebSocket will handle updating the challenges list
          }}
        />
      )}

      {selectedCharacter && selectedDie && (
        <DiceRollModal
          character={selectedCharacter}
          selectedDie={selectedDie}
          challenge={selectedChallenge || undefined}
          onClose={() => {
            setSelectedCharacter(null);
            setSelectedDie(null);
            setSelectedChallenge(null);
          }}
          onSuccess={handleModalSuccess}
        />
      )}

      {showDicePoolModal && selectedCharacterForPool && (
        <DicePoolModal
          character={selectedCharacterForPool}
          existingPool={isEditingPool ? dicePools[selectedCharacterForPool.id] : undefined}
          isGM={!!isGM}
          onClose={() => {
            setShowDicePoolModal(false);
            setSelectedCharacterForPool(null);
            setIsEditingPool(false);
          }}
          onSuccess={handleDicePoolSuccess}
        />
      )}
    </div>
  );
}