import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { campaignService } from '../services/campaignService';
import { characterService } from '../services/characterService';
import { diceService } from '../services/diceService';
import { challengeService } from '../services/challengeService';
import CharacterCard from '../components/CharacterCard';
import CreateCharacterModal from '../components/CreateCharacterModal';
import CreateChallengeModal from '../components/CreateChallengeModal';
import ChallengeList from '../components/ChallengeList';
import DiceRollModal from '../components/DiceRollModal';
import type { Campaign, Character, DicePool, ChallengeWithStats, PoolDie } from '../types';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [dicePools, setDicePools] = useState<Record<number, DicePool>>({});
  const [challenges, setChallenges] = useState<ChallengeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showCreateCharacterModal, setShowCreateCharacterModal] = useState(false);
  const [showCreateChallengeModal, setShowCreateChallengeModal] = useState(false);
  
  // For dice rolling
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedDie, setSelectedDie] = useState<PoolDie | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeWithStats | null>(null);

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
    try {
      const pool = await diceService.rollNewPool(characterId);
      setDicePools((prev) => ({ ...prev, [characterId]: pool }));
    } catch (error) {
      console.error('Failed to roll dice pool:', error);
    }
  };

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

    // Set up for rolling
    setSelectedChallenge(challenge);
    setSelectedCharacter(myCharacter);
    // Don't auto-select a die - let them choose in CharacterCard
  };

  const handleCompleteChallenge = async (challengeId: number) => {
    try {
      await challengeService.complete(challengeId);
      loadCampaignData(); // Refresh to remove completed challenge
    } catch (error) {
      console.error('Failed to complete challenge:', error);
    }
  };

  const handleDieClick = (character: Character, die: PoolDie) => {
    if (die.is_used) return;
    
    setSelectedCharacter(character);
    setSelectedDie(die);
    // selectedChallenge might already be set, or null for free roll
  };

  const handleRollComplete = () => {
    setSelectedCharacter(null);
    setSelectedDie(null);
    setSelectedChallenge(null);
    loadCampaignData(); // Refresh everything
  };

  const isGM = campaign && user && campaign.gm_user_id === user.id;

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
                <h1 className="text-2xl font-bold">{campaign.name}</h1>
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
        {/* Challenges Section */}
        <div className="mb-8">
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
        <div className="flex justify-between items-center mb-6">
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
            <p className="text-gray-600 mb-4">No characters yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                gmUserId={campaign.gm_user_id}
                dicePool={dicePools[character.id]}
                onRollPool={() => handleRollPool(character.id)}
                onViewDetails={() => navigate(`/characters/${character.id}`)}
                onDiceUsed={loadCampaignData}
                onDieClick={(die) => handleDieClick(character, die)}
              />
            ))}
          </div>
        )}
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
            loadCampaignData();
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
          onSuccess={handleRollComplete}
        />
      )}
    </div>
  );
}