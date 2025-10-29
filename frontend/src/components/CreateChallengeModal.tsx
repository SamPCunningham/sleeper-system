import { useState } from 'react';
import { challengeService } from '../services/challengeService';

interface CreateChallengeModalProps {
  campaignId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateChallengeModal({
  campaignId,
  onClose,
  onSuccess,
}: CreateChallengeModalProps) {
  const [description, setDescription] = useState('');
  const [difficultyModifier, setDifficultyModifier] = useState(0);
  const [isGroupChallenge, setIsGroupChallenge] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setError('');
    setIsCreating(true);

    try {
      await challengeService.create({
        campaign_id: campaignId,
        description,
        difficulty_modifier: difficultyModifier,
        is_group_challenge: isGroupChallenge,
      });
      onSuccess();
    } catch (err: any) {
      const errorMsg = err.response?.data || 'Failed to create challenge';
      setError(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Create Challenge</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Challenge Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="e.g., Make a Stealth check to sneak past the guards"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Modifier
            </label>
            <select
              value={difficultyModifier}
              onChange={(e) => setDifficultyModifier(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={2}>Very Easy (+2)</option>
              <option value={1}>Easy (+1)</option>
              <option value={0}>Normal (0)</option>
              <option value={-1}>Hard (-1)</option>
              <option value={-2}>Very Hard (-2)</option>
              <option value={-3}>Extremely Hard (-3)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Modifies the d6 roll before checking success
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isGroupChallenge}
                onChange={(e) => setIsGroupChallenge(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Group Challenge (everyone can attempt)
              </span>
            </label>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isCreating ? 'Creating...' : 'Create Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}