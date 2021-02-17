import React from 'react';
import { Button } from 'semantic-ui-react';
import type { Network as NetworkModel } from '../model';
import Network from './network';
import ToggleWalkButton from './ToggleWalkButton';
import Histogram from './histogram';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const step = () => props.network.walker.step();

  return (
    <>
      <Network network={network} />
      <Button onClick={step}>Step</Button>
      <ToggleWalkButton onClick={step} />
      <Histogram network={network} />
      <br />
      {'One-level codelength'}{' '}
      {network.mapequation.oneLevelCodelength.toFixed(3)} {'bits'}
      <br />
      {'Index codelength'} {network.mapequation.indexCodelength.toFixed(5)}{' '}
      {'bits'}
      <br />
      {'Module codelength'}{' '}
      {network.mapequation.moduleCodelengths
        .reduce((a, b) => a + b, 0.0)
        .toFixed(5)}{' '}
      {'bits'}
      <br />
      {'Codelength'} {network.mapequation.codelength.toFixed(3)} {'bits'}
    </>
  );
}
