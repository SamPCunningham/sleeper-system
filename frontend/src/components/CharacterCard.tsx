import { useAuthStore } from '../store/authStore';
import type { Character, DicePool } from '../types';

interface CharacterCardProps {
  character: Character;
  gmUserId: number;
  dicePool?: DicePool;
  onRollPool: () => void;
  onViewDetails: () => void;
}

export default function CharacterCard({
  character,
  gmUserId,
  dicePool,
  onRollPool,
  onViewDetails,
}: CharacterCardProps) {
  const user = useAuthStore((state) => state.user);
  
  // Check if user can interact with this character
  const isOwner = user?.id === character.user_id;
  const isGM = user?.id === gmUserId;
  const canInteract = isOwner || isGM;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold">{character.name}</h3>
          <div className="text-sm text-gray-600 mt-1">
            {character.skill_name && (
              <span className="text-green-600">
                +{character.skill_modifier} {character.skill_name}
              </span>
            )}
            {character.skill_name && character.weakness_name && ' • '}
            {character.weakness_name && (
              <span className="text-red-600">
                {character.weakness_modifier} {character.weakness_name}
              </span>
            )}
          </div>
        </div>
        {canInteract && (
          <button
            onClick={onViewDetails}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Edit →
          </button>
        )}
      </div>

      {/* Dice Pool */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold">Dice Pool</h4>
          {canInteract && (
            <button
              onClick={onRollPool}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Roll New Pool
            </button>
          )}
        </div>

        {dicePool ? (
          <div className="flex gap-2">
            {dicePool.dice.map((die) => (
              <div
                key={die.id}
                className={`w-12 h-12 flex items-center justify-center text-xl font-bold rounded border-2 ${
                  die.is_used
                    ? 'bg-gray-200 border-gray-400 text-gray-500 line-through'
                    : 'bg-white border-blue-600 text-blue-600'
                }`}
              >
                {die.die_result}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No dice pool yet. Roll to start!</p>
        )}
      </div>
    </div>
  );
}