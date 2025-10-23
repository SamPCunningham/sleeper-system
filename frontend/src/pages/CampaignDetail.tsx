import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { campaignService } from '../services/campaignService';
import { characterService } from '../services/characterService';
import { diceService } from '../services/diceService';
import CharacterCard from '../components/CharacterCard';
import CreateCharacterModal from '../components/CreateCharacterModal';
import type { Campaign, Character, DicePool } from '../types';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [dicePools, setDicePools] = useState<Record<number, DicePool>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadCampaignData();
    }
  }, [id]);

  const loadCampaignData = async () => {
    try {
      const [campaignData, charactersData] = await Promise.all([
        campaignService.get(Number(id)),
        characterService.listByCampaign(Number(id)),
      ]);

      const charactersArray = Array.isArray(charactersData) ? charactersData : [];
      setCampaign(campaignData);
      setCharacters(charactersArray);

      // Load dice pools for all characters
      const pools: Record<number, DicePool> = {};
      for (const char of charactersData) {
        try {
          const pool = await diceService.getCurrentPool(char.id);
          pools[char.id] = pool;
        } catch (err) {
          // Character might not have a pool yet
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
      // Reset all dice pools
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Characters</h2>
          <button
            onClick={() => setShowCreateModal(true)}
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
                    gmUserId={campaign.gm_user_id}  // Just pass the ID
                    dicePool={dicePools[character.id]}
                    onRollPool={() => handleRollPool(character.id)}
                    onViewDetails={() => navigate(`/characters/${character.id}`)}
                />
            ))}
          </div>
        )}
      </div>

      {/* Create Character Modal */}
      {showCreateModal && (
        <CreateCharacterModal
          campaignId={campaign.id}
          gmUserId={campaign.gm_user_id}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadCampaignData();
          }}
        />
      )}
    </div>
  );
}