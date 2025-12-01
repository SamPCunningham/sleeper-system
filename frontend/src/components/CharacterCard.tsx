import { useAuthStore } from '../store/authStore';
import type { Character, DicePool, PoolDie } from '../types'; // Add PoolDie here

interface CharacterCardProps {
  character: Character;
  gmUserId: number;
  dicePool?: DicePool;
  onRollPool: () => void;
  onViewDetails: () => void;
  onDieClick: (die: PoolDie) => void;
  onEditPool: () => void;
}

export default function CharacterCard({
  character,
  gmUserId,
  dicePool,
  onRollPool,
  onViewDetails,
  onDieClick,
  onEditPool
}: CharacterCardProps) {
  const user = useAuthStore((state) => state.user);
  
  const isOwner = user?.id === character.user_id;
  const isGM = user?.id === gmUserId;
  const canInteract = isOwner || isGM;

  const handleDieClick = (die: PoolDie) => {
    if (canInteract && !die.is_used) {
      onDieClick(die);
    }
  };

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
          <div className="flex gap-2">
            {canInteract && (
              <button
                onClick={onRollPool}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Roll New Pool
              </button>
            )}
            {isGM && dicePool && (
              <button
                onClick={onEditPool}
                className="text-sm bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                >
                  Edit
                </button>
            )}
          </div>
        </div>

        {dicePool ? (
          <div className="flex gap-2">
            {dicePool.dice.map((die) => (
              <button
                key={die.id}
                onClick={() => handleDieClick(die)}
                disabled={die.is_used || !canInteract}
                className={`w-12 h-12 flex items-center justify-center text-xl font-bold rounded border-2 transition-all ${
                  die.is_used
                    ? 'bg-gray-200 border-gray-400 text-gray-500 line-through cursor-not-allowed'
                    : canInteract
                      ? 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50 cursor-pointer'
                      : 'bg-white border-blue-600 text-blue-600 cursor-default'
                }`}
              >
                {die.die_result}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No dice pool yet. Roll to start!</p>
        )}
      </div>
    </div>
  );
}