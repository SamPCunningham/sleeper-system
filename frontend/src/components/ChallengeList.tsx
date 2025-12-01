import type { ChallengeWithStats } from '../types';

interface ChallengeListProps {
  challenges: ChallengeWithStats[];
  isGM: boolean;
  onAttemptChallenge: (challenge: ChallengeWithStats) => void;
  onCompleteChallenge: (challengeId: number) => void;
}

export default function ChallengeList({
  challenges,
  isGM,
  onAttemptChallenge,
  onCompleteChallenge,
}: ChallengeListProps) {
  if (challenges.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        No active challenges
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {challenges.map((challenge) => (
        <div key={challenge.id} className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-lg">{challenge.description}</h4>
                {challenge.is_group_challenge && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    GROUP
                  </span>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                Difficulty: {challenge.difficulty_modifier > 0 ? '+' : ''}{challenge.difficulty_modifier}
                {' • '}
                {challenge.total_attempts} attempt{challenge.total_attempts !== 1 ? 's' : ''}
                {challenge.total_attempts > 0 && (
                  <>
                    {' '}({challenge.successful_attempts} success, {challenge.failed_attempts} fail)
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onAttemptChallenge(challenge)}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Attempt
              </button>
              {isGM && (
                <button
                  onClick={() => onCompleteChallenge(challenge.id)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Complete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}