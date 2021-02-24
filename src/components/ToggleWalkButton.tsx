import React, { useState } from 'react';

interface Props {
  onClick: () => void;
  interval?: 200;
}

export default function ToggleWalkButton({ onClick, interval = 200 }: Props) {
  const [id, setId] = useState(0);

  const positive = id === 0;

  const toggle = () => {
    if (positive) {
      let intervalId = window.setInterval(onClick, interval);
      setId(intervalId);
    } else {
      clearInterval(id);
      setId(0);
    }
  };

  return <button onClick={toggle}>{positive ? 'Start' : 'Stop'}</button>;
}
