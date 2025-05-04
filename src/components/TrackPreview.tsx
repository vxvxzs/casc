import React from 'react';

interface Props {
  track: string;
}

const TrackPreview: React.FC<Props> = ({ track }) => {
  if (!track) return null;

  const formattedName = track.replace(/ /g, '%20'); // dla URL encode
  const src = `/tracks/${formattedName}.jpg`;

  return (
    <div className="track-preview">
      <img src={src} alt={track} className="track-image" />
    </div>
  );
};

export default TrackPreview;
