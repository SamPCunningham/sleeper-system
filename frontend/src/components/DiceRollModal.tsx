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
  const [outcome, setOutcome] = useState<string | null>(null);
  const [useManual, setUseManual] = useState(false);

  const getModifiedD6 = () => {
    let modified = selectedDie.die_result;
    
    if (skillApplied) {
      modified += character.skill_modifier;
    }
    
    modified += otherModifiers;
    
    if (challenge) {
      modified += challenge.difficulty_modifier;
    }
    
    if (modified < 1) modified = 1;
    if (modified > 6) modified = 6;
    
    return modified;
  };

  const modifiedD6 = getModifiedD6();

  const getSuccessThreshold = (d6: number): string => {
    switch (d6) {
      case 6:
        return 'Guaranteed Success';
      case 5:
        return '11-20: Success | 1-10: Neutral';
      case 3:
      case 4:
        return '16-20: Success | 6-15: Neutral | 1-5: Failure';
      case 1:
      case 2:
        return '11-20: Neutral | 1-10: Failure';
      default:
        return '';
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'border-green-600 text-green-600 bg-green-50';
      case 'neutral':
        return 'border-yellow-600 text-yellow-600 bg-yellow-50';
      case 'failure':
        return 'border-red-600 text-red-600 bg-red-50';
      default:
        return 'border-gray-600 text-gray-600 bg-gray-50';
    }
  };

  const getOutcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'SUCCESS!';
      case 'neutral':
        return 'NEUTRAL';
      case 'failure':
        return 'FAILURE';
      default:
        return 'UNKNOWN';
    }
  };

  const handleRollAndSubmit = async (d20: number) => {
    setD20Result(d20);
    setIsRolling(true);
    
    try {
      const result = await diceService.recordRoll({
        character_id: character.id,
        pool_dice_id: selectedDie.id,
        d20_roll: d20,
        action_type: actionType || undefined,
        notes: notes || undefined,
        challenge_id: challenge?.id,
        skill_applied: skillApplied,
        other_modifiers: otherModifiers,
      });
      
      // Backend returns the outcome
      setOutcome(result.outcome);
      setIsRolling(false);
      
      // Wait a moment so user can see the result, then close
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Failed to record roll:', error);
      setIsRolling(false);
    }
  };

  const handleAutoRoll = () => {
    const result = Math.floor(Math.random() * 20) + 1;
    handleRollAndSubmit(result);
  };

  const handleManualSubmit = () => {
    const result = Number(manualD20);
    if (result < 1 || result > 20) {
      alert('Please enter a number between 1 and 20');
      return;
    }
    handleRollAndSubmit(result);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">Roll for {character.name}</h3>

        {challenge && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm font-medium text-blue-900">Challenge:</p>
            <p className="text-sm text-blue-800">{challenge.description}</p>
            <p className="text-xs text-blue-600 mt-1">
              Base Difficulty: {challenge.difficulty_modifier > 0 ? '+' : ''}{challenge.difficulty_modifier}
            </p>
          </div>
        )}

        <div className="mb-4 text-center">
          <p className="text-sm text-gray-600 mb-2">Base d6: {selectedDie.die_result}</p>
          
          {!isRolling && outcome === null && (
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
          <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">
            {getSuccessThreshold(modifiedD6)}
          </p>
        </div>

        {isRolling ? (
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 text-3xl font-bold rounded border-4 border-blue-600 text-blue-600 bg-blue-50">
              <span className="animate-pulse">...</span>
            </div>
            <p className="text-lg font-bold mt-2 text-blue-600">
              Rolling...
            </p>
          </div>
        ) : outcome !== null && d20Result !== null ? (
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-600 mb-2">d20 Result:</p>
            <div className={`inline-flex items-center justify-center w-20 h-20 text-3xl font-bold rounded border-4 ${getOutcomeColor(outcome)}`}>
              {d20Result}
            </div>
            <p className={`text-lg font-bold mt-2 ${
              outcome === 'success' ? 'text-green-600' : 
              outcome === 'neutral' ? 'text-yellow-600' : 
              'text-red-600'
            }`}>
              {getOutcomeLabel(outcome)}
            </p>
          </div>
        ) : null}

        {!isRolling && outcome === null && (
          <>
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
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={useManual ? handleManualSubmit : handleAutoRoll}
                disabled={useManual && !manualD20}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {useManual ? 'Submit Roll' : 'Roll d20'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}