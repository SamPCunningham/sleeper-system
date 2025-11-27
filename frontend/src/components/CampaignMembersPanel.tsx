import { useState, useEffect } from 'react';
import { campaignService } from '../services/campaignService';
import { adminService } from '../services/adminService';
import { useAuthStore } from '../store/authStore';
import type { CampaignMember, User } from '../types';

interface CampaignMembersPanelProps {
  campaignId: number;
  gmUserId: number;
}

export default function CampaignMembersPanel({ campaignId, gmUserId }: CampaignMembersPanelProps) {
  const { user: currentUser, isAdmin } = useAuthStore();
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGM = currentUser?.id === gmUserId;
  const canManageMembers = isGM || isAdmin();

  useEffect(() => {
    loadMembers();
  }, [campaignId]);

  const loadMembers = async () => {
    try {
      setError(null);
      const data = await campaignService.listMembers(campaignId);
      setMembers(data);
    } catch (err: any) {
      setError(err.response?.data || 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const users = await adminService.listUsers();
      // Filter out users who are already members
      const memberIds = new Set(members.map(m => m.user_id));
      const nonMembers = users.filter(u => !memberIds.has(u.id));
      setAllUsers(nonMembers);
    } catch (err) {
      // If not admin, we can't list all users - that's ok
      setAllUsers([]);
    }
  };

  const handleOpenAddModal = async () => {
    await loadAllUsers();
    setSelectedUserId('');
    setShowAddModal(true);
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      await campaignService.addMember(campaignId, Number(selectedUserId));
      setShowAddModal(false);
      loadMembers();
    } catch (err: any) {
      setError(err.response?.data || 'Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: number, username: string) => {
    if (!confirm(`Remove ${username} from this campaign?`)) return;

    try {
      await campaignService.removeMember(campaignId, userId);
      loadMembers();
    } catch (err: any) {
      setError(err.response?.data || 'Failed to remove member');
    }
  };

  const getRoleBadge = (member: CampaignMember) => {
    if (member.is_gm) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">GM</span>;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-gray-500">Loading members...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">Campaign Members</h3>
          <p className="text-sm text-gray-600">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {canManageMembers && (
          <button
            onClick={handleOpenAddModal}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            Add Player
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="divide-y">
        {members.map((member) => (
          <div key={member.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
                {member.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{member.username}</span>
                  {getRoleBadge(member)}
                </div>
                <span className="text-sm text-gray-500">{member.email}</span>
              </div>
            </div>
            
            {canManageMembers && !member.is_gm && (
              <button
                onClick={() => handleRemoveMember(member.user_id, member.username)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="p-4 text-gray-500 text-center">
            No members yet
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add Player to Campaign</h3>
            
            {allUsers.length === 0 ? (
              <div className="text-gray-600 mb-4">
                <p>No users available to add.</p>
                <p className="text-sm mt-2">
                  {isAdmin() 
                    ? 'Create new users in the Admin panel first.' 
                    : 'Ask an admin to create user accounts.'}
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose a user...</option>
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              {allUsers.length > 0 && (
                <button
                  onClick={handleAddMember}
                  disabled={!selectedUserId || isSubmitting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}