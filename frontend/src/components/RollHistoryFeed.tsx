import { useEffect, useState } from 'react';
import { diceService } from '../services/diceService';
import type { RollHistoryWithCharacter } from '../types';

interface RollHistoryFeedProps {
  campaignId: number;
  refreshTrigger?: number;
}

export default function RollHistoryFeed({ campaignId, refreshTrigger }: RollHistoryFeedProps) {
  const [rolls, setRolls] = useState<RollHistoryWithCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRolls();
  }, [campaignId, refreshTrigger]);

  const loadRolls = async () => {
    try {
      setError(null);
      const data = await diceService.getCampaignRollHistory(campaignId);
      setRolls(data || []);
      console.log(data);
    } catch (error: any) {
      console.error('Failed to load roll history:', error);
      setError(error.response?.data || 'Failed to load roll history');
      setRolls([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        Loading roll history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-red-600 mb-2">{error}</p>
        <button 
          onClick={loadRolls}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (rolls.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        No rolls yet. Be the first to roll!
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg">Roll History</h3>
        <p className="text-sm text-gray-600">Recent rolls from all players</p>
      </div>
      
      <div className="divide-y max-h-96 overflow-y-auto">
        {rolls.map((roll) => (
          <div key={roll.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Character name and time */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">
                    {roll.character_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(roll.created_at)}
                  </span>
                </div>
                
                {/* Action type */}
                {roll.action_type && (
                  <p className="text-sm text-gray-700 mb-2">{roll.action_type}</p>
                )}
                
                {/* Dice results */}
                <div className="flex items-center gap-2 flex-wrap">
                  {roll.modified_d6 !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-600">d6:</span>
                      <span className="inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded border-2 border-blue-600 text-blue-600 bg-blue-50">
                        {roll.modified_d6}
                      </span>
                    </div>
                  )}
                  
                  {roll.d20_roll !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-600">d20:</span>
                      <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded border-2 ${
                        roll.outcome === 'success' 
                          ? 'border-green-600 text-green-600 bg-green-50' 
                          : roll.outcome === 'neutral'
                            ? 'border-yellow-600 text-yellow-600 bg-yellow-50'
                            : 'border-red-600 text-red-600 bg-red-50'
                      }`}>
                        {roll.d20_roll}
                      </span>
                    </div>
                  )}
                  
                  {/* Modifiers indicator */}
                  {(roll.skill_applied || roll.other_modifiers !== 0) && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {roll.skill_applied && '+skill'}
                      {roll.skill_applied && roll.other_modifiers !== 0 && ', '}
                      {roll.other_modifiers !== 0 && `${roll.other_modifiers > 0 ? '+' : ''}${roll.other_modifiers}`}
                    </span>
                  )}
                </div>
                
                {/* Notes */}
                {roll.notes && (
                  <p className="text-xs text-gray-600 mt-2 italic">"{roll.notes}"</p>
                )}
              </div>
              
              {/* Outcome badge - UPDATED */}
              {roll.outcome && (
                <span className={`shrink-0 px-2 py-1 text-xs font-semibold rounded ${
                  roll.outcome === 'success'
                    ? 'bg-green-100 text-green-800'
                    : roll.outcome === 'neutral'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {roll.outcome.charAt(0).toUpperCase() + roll.outcome.slice(1)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}