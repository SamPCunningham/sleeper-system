import { useState } from 'react';
import { diceService } from '../services/diceService';
import type { PoolDie, ChallengeWithStats, Character } from '../types';

interface DiceRollModalProps {
  character: Character;
  selectedDie: PoolDie;
  challenge?: ChallengeWithStats;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DiceRollModal({
  character,
  selectedDie,
  challenge,
  onClose,
  onSuccess,
}: DiceRollModalProps) {
  const [d20Result, setD20Result] = useState<number | null>(null);
  const [manualD20, setManualD20] = useState('');
  const [actionType, setActionType] = useState(challenge?.description || '');
  const [notes, setNotes] = useState('');
  const [skillApplied, setSkillApplied] = useState(false);
  const [otherModifiers, setOtherModifiers] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [useManual, setUseManual] = useState(false);

  const getModifiedD6 = () => {
    let modified = selectedDie.die_result;
    
    // Apply skill if checked
    if (skillApplied) {
      modified += character.skill_modifier;
    }
    
    // Apply other modifiers
    modified += otherModifiers;
    
    // Apply challenge difficulty
    if (challenge) {
      modified += challenge.difficulty_modifier;
    }
    
    // Keep in bounds
    if (modified < 1) modified = 1;
    if (modified > 6) modified = 6;
    
    return modified;
  };

  const modifiedD6 = getModifiedD6();

  const rollD20 = () => {
    const result = Math.floor(Math.random() * 20) + 1;
    setD20Result(result);
    const calculatedSuccess = calculateSuccess(modifiedD6, result);
    setSuccess(calculatedSuccess);
  };

  const handleManualEntry = () => {
    const result = Number(manualD20);
    if (result < 1 || result > 20) {
      alert('Please enter a number between 1 and 20');
      return;
    }
    setD20Result(result);
    const calculatedSuccess = calculateSuccess(modifiedD6, result);
    setSuccess(calculatedSuccess);
  };

  const calculateSuccess = (d6: number, d20: number): boolean => {
    switch (d6) {
      case 6:
        return true;
      case 5:
        return d20 > 10;
      case 3:
      case 4:
        return d20 > 15;
      case 1:
      case 2:
        return false;
      default:
        return false;
    }
  };

  const getSuccessThreshold = (d6: number): string => {
    switch (d6) {
      case 6:
        return 'Guaranteed Success';
      case 5:
        return 'Need 11+ (50%)';
      case 3:
      case 4:
        return 'Need 16+ (25%)';
      case 1:
      case 2:
        return 'Cannot Succeed';
      default:
        return '';
    }
  };

  const handleSubmit = async () => {
    if (d20Result === null) {
      if (useManual) {
        handleManualEntry();
      } else {
        rollD20();
      }
      return;
    }

    setIsRolling(true);
    try {
      await diceService.recordRoll({
        character_id: character.id,
        pool_dice_id: selectedDie.id,
        d20_roll: d20Result,
        action_type: actionType || undefined,
        notes: notes || undefined,
        challenge_id: challenge?.id,
        skill_applied: skillApplied,
        other_modifiers: otherModifiers,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to record roll:', error);
    } finally {
      setIsRolling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">Roll for {character.name}</h3>

        {/* Challenge Info */}
        {challenge && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm font-medium text-blue-900">Challenge:</p>
            <p className="text-sm text-blue-800">{challenge.description}</p>
            <p className="text-xs text-blue-600 mt-1">
              Base Difficulty: {challenge.difficulty_modifier > 0 ? '+' : ''}{challenge.difficulty_modifier}
            </p>
          </div>
        )}

        {/* Show selected d6 */}
        <div className="mb-4 text-center">
          <p className="text-sm text-gray-600 mb-2">Base d6: {selectedDie.die_result}</p>
          
          {/* Modifiers */}
          {d20Result === null && (
            <div className="space-y-2 mb-3">
              {character.skill_name && (
                <label className="flex items-center justify-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skillApplied}
                    onChange={(e) => setSkillApplied(e.target.checked)}
                    className="rounded"
                  />
                  <span>Apply {character.skill_name} ({character.skill_modifier > 0 ? '+' : ''}{character.skill_modifier})</span>
                </label>
              )}
              
              <div className="flex items-center justify-center gap-2 text-sm">
                <label>Other Modifiers:</label>
                <input
                  type="number"
                  value={otherModifiers}
                  onChange={(e) => setOtherModifiers(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-gray-300 rounded"
                  min="-5"
                  max="5"
                />
              </div>
            </div>
          )}

          <div className="inline-flex items-center justify-center w-16 h-16 text-2xl font-bold rounded border-2 border-blue-600 text-blue-600 bg-blue-50">
            {modifiedD6}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {getSuccessThreshold(modifiedD6)}
          </p>
        </div>

        {/* d20 Result */}
        {d20Result !== null && (
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-600 mb-2">d20 Result:</p>
            <div className={`inline-flex items-center justify-center w-20 h-20 text-3xl font-bold rounded border-4 ${
              success 
                ? 'border-green-600 text-green-600 bg-green-50' 
                : 'border-red-600 text-red-600 bg-red-50'
            }`}>
              {d20Result}
            </div>
            <p className={`text-lg font-bold mt-2 ${success ? 'text-green-600' : 'text-red-600'}`}>
              {success ? 'SUCCESS!' : 'FAILURE'}
            </p>
          </div>
        )}

        {/* Roll mode toggle */}
        {d20Result === null && (
          <div className="mb-4">
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setUseManual(false)}
                className={`flex-1 py-2 px-4 rounded ${
                  !useManual 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Auto Roll
              </button>
              <button
                type="button"
                onClick={() => setUseManual(true)}
                className={`flex-1 py-2 px-4 rounded ${
                  useManual 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Manual Entry
              </button>
            </div>

            {useManual && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your d20 roll:
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={manualD20}
                  onChange={(e) => setManualD20(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1-20"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        {/* Action details */}
        <div className="space-y-4">
          {!challenge && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Type (optional)
              </label>
              <input
                type="text"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Charisma Check, Combat Attack"
                disabled={d20Result !== null}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Add any notes..."
              disabled={d20Result !== null}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
            disabled={isRolling}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isRolling || (useManual && d20Result === null && !manualD20)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {d20Result === null 
              ? useManual ? 'Submit Roll' : 'Roll d20' 
              : isRolling 
                ? 'Recording...' 
                : 'Record Roll'}
          </button>
        </div>
      </div>
    </div>
  );
}