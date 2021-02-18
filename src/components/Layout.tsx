import React, { useState } from 'react';
import { Button } from 'semantic-ui-react';
import type { Network as NetworkModel } from '../model';
import Network from './Network';
import ToggleWalkButton from './ToggleWalkButton';
import RateView from './RateView';

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
      <br />
      {'One-level codelength'}{' '}
      {network.mapequation.oneLevelCodelength.toFixed(3)} {'bits'}
      <br />
      {'Index codelength'} {network.mapequation.indexCodelength.toFixed(3)}{' '}
      {'bits'}
      <br />
      {'Module codelength'} {network.mapequation.moduleCodelength.toFixed(3)}{' '}
      {'bits'}
      <br />
      {'Codelength'} {network.mapequation.codelength.toFixed(3)} {'bits'}
    </>
  );
}
