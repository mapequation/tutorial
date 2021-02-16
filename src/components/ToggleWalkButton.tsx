import React, { useState } from 'react';
import { Button } from 'semantic-ui-react';

export default function ToggleWalkButton(props: { onClick: () => void }) {
  const { onClick } = props;

  let [id, setId] = useState(0);

  const positive = id === 0;

  const toggle = () => {
    if (positive) {
      let intervalId = window.setInterval(onClick, 200);
      setId(intervalId);
    } else {
      clearInterval(id);
      setId(0);
    }
  };

  return (
    <Button positive={positive} negative={!positive} onClick={toggle}>
      {!positive && 'Stop'}
      {positive && 'Start'}
    </Button>
  );
}
