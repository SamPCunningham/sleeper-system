import { useState, useEffect } from 'react';
import { diceService } from '../services/diceService';
import type { Character, DicePool, PoolDie } from '../types';

interface DicePoolModalProps {
  character: Character;
  existingPool?: DicePool;
  isGM: boolean;
  onClose: () => void;
  onSuccess: (pool: DicePool) => void;
}

export default function DicePoolModal({
  character,
  existingPool,
  isGM,
  onClose,
  onSuccess,
}: DicePoolModalProps) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [diceValues, setDiceValues] = useState<string[]>(
    existingPool 
      ? existingPool.dice.map(d => d.die_result.toString())
      : Array(character.max_daily_dice).fill('')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingDieId, setEditingDieId] = useState<number | null>(null);

  const isEditing = !!existingPool;

  useEffect(() => {
    if (existingPool) {
      setDiceValues(existingPool.dice.map(d => d.die_result.toString()));
    }
  }, [existingPool]);

  const handleDiceValueChange = (index: number, value: string) => {
    if (value === '' || (Number(value) >= 1 && Number(value) <= 6)) {
      const newValues = [...diceValues];
      newValues[index] = value;
      setDiceValues(newValues);
    }
  };

  const handleAutoRoll = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const pool = await diceService.rollNewPool(character.id);
      onSuccess(pool);
    } catch (err: any) {
      setError(err.response?.data || 'Failed to roll dice pool');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async () => {
    setError('');

    // Validate all dice have values
    const numericValues = diceValues.map(v => Number(v));
    if (numericValues.some(v => isNaN(v) || v < 1 || v > 6)) {
      setError('All dice must have values between 1 and 6');
      return;
    }

    setIsSubmitting(true);

    try {
      const pool = await diceService.manualRollPool(character.id, numericValues);
      onSuccess(pool);
    } catch (err: any) {
      setError(err.response?.data || 'Failed to create dice pool');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDie = async (die: PoolDie, newValue: number) => {
    if (newValue < 1 || newValue > 6) {
      setError('Die value must be between 1 and 6');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await diceService.updatePoolDie(die.id, newValue);
      // Update local state
      const updatedPool = {
        ...existingPool!,
        dice: existingPool!.dice.map(d =>
          d.id === die.id ? { ...d, die_result: newValue } : d
        ),
      };
      onSuccess(updatedPool);
      setEditingDieId(null);
    } catch (err: any) {
      setError(err.response?.data || 'Failed to update die');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDiceInputs = () => {
    if (isEditing && existingPool) {
      // Show existing dice with edit capability for GM
      return (
        <div className="grid grid-cols-3 gap-3">
          {existingPool.dice.map((die, index) => (
            <div key={die.id} className="flex flex-col items-center">
              <label className="text-xs text-gray-600 mb-1">Die {index + 1}</label>
              {isGM && editingDieId === die.id ? (
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={diceValues[index]}
                  onChange={(e) => handleDiceValueChange(index, e.target.value)}
                  onBlur={() => {
                    if (diceValues[index]) {
                      handleEditDie(die, Number(diceValues[index]));
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && diceValues[index]) {
                      handleEditDie(die, Number(diceValues[index]));
                    }
                  }}
                  className="w-16 h-16 text-center text-2xl font-bold border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  disabled={die.is_used}
                />
              ) : (
                <button
                  onClick={() => {
                    if (isGM && !die.is_used) {
                      setEditingDieId(die.id);
                    }
                  }}
                  disabled={die.is_used || !isGM}
                  className={`w-16 h-16 text-2xl font-bold rounded border-2 transition-all ${
                    die.is_used
                      ? 'bg-gray-200 border-gray-400 text-gray-500 line-through cursor-not-allowed'
                      : isGM
                        ? 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50 cursor-pointer'
                        : 'bg-white border-blue-600 text-blue-600 cursor-default'
                  }`}
                >
                  {die.die_result}
                </button>
              )}
              {die.is_used && (
                <span className="text-xs text-gray-500 mt-1">Used</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Manual entry for new pool
    return (
      <div className="grid grid-cols-3 gap-3">
        {diceValues.map((value, index) => (
          <div key={index} className="flex flex-col items-center">
            <label className="text-xs text-gray-600 mb-1">Die {index + 1}</label>
            <input
              type="number"
              min="1"
              max="6"
              value={value}
              onChange={(e) => handleDiceValueChange(index, e.target.value)}
              className="w-16 h-16 text-center text-2xl font-bold border-2 border-gray-300 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="?"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">
          {isEditing ? `Edit Dice Pool for ${character.name}` : `Roll Dice Pool for ${character.name}`}
        </h3>

        {!isEditing && (
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('auto')}
                className={`flex-1 py-2 px-4 rounded ${
                  mode === 'auto'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Auto Roll
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 py-2 px-4 rounded ${
                  mode === 'manual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Manual Entry
              </button>
            </div>

            {mode === 'auto' ? (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">
                  Roll {character.max_daily_dice}d6 automatically
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Enter the values you rolled on your physical dice:
                </p>
                {renderDiceInputs()}
              </div>
            )}
          </div>
        )}

        {isEditing && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">
              {isGM
                ? 'Click a die to edit its value:'
                : 'Current dice pool:'}
            </p>
            {renderDiceInputs()}
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
            disabled={isSubmitting}
          >
            {isEditing ? 'Done' : 'Cancel'}
          </button>
          {!isEditing && (
            <button
              onClick={mode === 'auto' ? handleAutoRoll : handleManualSubmit}
              disabled={isSubmitting || (mode === 'manual' && diceValues.some(v => !v))}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSubmitting ? 'Rolling...' : mode === 'auto' ? 'Roll Dice' : 'Create Pool'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}