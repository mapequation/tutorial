import React, { useState } from 'react';
import { Button } from 'semantic-ui-react';
import type { Network as NetworkModel } from '../model';
import Network from './Network';
import ToggleWalkButton from './ToggleWalkButton';
import RateView from './RateView';
import CodeView from './CodeView';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [showVisitRate, setShowVisitRate] = useState(false);

  const step = () => {
    if (!showVisitRate) setShowVisitRate(true);
    props.network.walker.step();
  };

  return (
    <>
      <Network network={network} showVisitRate={showVisitRate} />
      <Button onClick={step}>Step</Button>
      <ToggleWalkButton onClick={step} />
      <RateView network={network} />
      <CodeView network={network} />
    </>
  );
}
