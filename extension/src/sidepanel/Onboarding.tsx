import { useState } from 'react';

export interface OnboardingWorkspace {
  vivaldiWorkspaceId: number;
  label: string;
}

interface OnboardingProps {
  discoveredIds: number[];
  onSave: (workspaces: OnboardingWorkspace[]) => void | Promise<void>;
}

export function Onboarding({ discoveredIds, onSave }: OnboardingProps) {
  const [labels, setLabels] = useState<Record<number, string>>(() =>
    Object.fromEntries(discoveredIds.map(id => [id, '']))
  );

  function handleChange(id: number, value: string) {
    setLabels(prev => ({ ...prev, [id]: value }));
  }

  function handleSave() {
    const workspaces: OnboardingWorkspace[] = discoveredIds
      .filter(id => {
        const label = labels[id];
        return typeof label === 'string' && label.trim().length > 0;
      })
      .map(id => ({
        vivaldiWorkspaceId: id,
        label: (labels[id] ?? '').trim(),
      }));

    void onSave(workspaces);
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Set up your workspaces</h2>
      <p className="text-sm text-gray-600">
        We found {discoveredIds.length} workspace{discoveredIds.length !== 1 ? 's' : ''}. Give each one a name.
      </p>
      <div className="flex flex-col gap-3">
        {discoveredIds.map(id => (
          <div key={id} className="flex flex-col gap-1">
            <label htmlFor={`workspace-label-${id}`}>
              {`Label for workspace ${id}`}
            </label>
            <input
              id={`workspace-label-${id}`}
              type="text"
              value={labels[id] ?? ''}
              onChange={e => handleChange(id, e.target.value)}
              placeholder="e.g. Work, Personal, Reading…"
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        className="self-start bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Save
      </button>
    </div>
  );
}
