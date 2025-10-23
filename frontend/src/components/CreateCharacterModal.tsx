import { useState, useEffect } from 'react';
import { characterService } from '../services/characterService';
import { campaignService } from '../services/campaignService';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';

interface CreateCharacterModalProps {
  campaignId: number;
  gmUserId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCharacterModal({
  campaignId,
  gmUserId,
  onClose,
  onSuccess,
}: CreateCharacterModalProps) {
  const user = useAuthStore((state) => state.user);
  const isGM = user?.id === gmUserId;

  const [name, setName] = useState('');
  const [skillName, setSkillName] = useState('');
  const [weaknessName, setWeaknessName] = useState('');
  const [assignedUserId, setAssignedUserId] = useState<number | ''>('');
  const [users, setUsers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isGM) {
      loadUsers();
    }
  }, [isGM]);

  const loadUsers = async () => {
    try {
      const usersData = await campaignService.listUsers(campaignId);
      setUsers(usersData);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsCreating(true);

    try {
      await characterService.create({
        campaign_id: campaignId,
        name,
        skill_name: skillName || undefined,
        skill_modifier: 1,
        weakness_name: weaknessName || undefined,
        weakness_modifier: -1,
        assigned_user_id: assignedUserId ? Number(assignedUserId) : undefined,
      });
      onSuccess();
    } catch (err: any) {
      const errorMsg = err.response?.data || 'Failed to create character';
      setError(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Create Character</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Character Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skill (+1)
            </label>
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Charisma, Combat, Tech"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weakness (-1)
            </label>
            <input
              type="text"
              value={weaknessName}
              onChange={(e) => setWeaknessName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Stealth, Medicine"
            />
          </div>

          {isGM && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Player (optional)
              </label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Leave unassigned to assign later
              </p>
            </div>
          )}

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
              {isCreating ? 'Creating...' : 'Create Character'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}