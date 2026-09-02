import type { ReactNode } from 'react';

type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const WIDTHS: Record<PreviewDevice, string> = {
  desktop: '100%',
  tablet: '420px',
  mobile: '340px',
};

interface PreviewFrameProps {
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  children: ReactNode;
}

export default function PreviewFrame({ device, onDeviceChange, children }: PreviewFrameProps) {
  return (
    <div className="card editor-preview">
      <div className="card-header editor-preview-header">
        <strong>Live Store Preview</strong>
        <div className="segmented">
          {(['desktop', 'tablet', 'mobile'] as PreviewDevice[]).map((d) => (
            <button
              key={d}
              type="button"
              className={device === d ? 'active' : ''}
              onClick={() => onDeviceChange(d)}
            >
              {d[0]!.toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body editor-preview-body">
        <div
          className="editor-preview-device"
          style={{ width: WIDTHS[device] }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
