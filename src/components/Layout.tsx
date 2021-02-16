import React from 'react';
import { Button } from 'semantic-ui-react';
import Network from './network';
import ToggleWalkButton from './ToggleWalkButton';
import type { Network as NetworkModel } from '../model';

export function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const step = () => props.network.walker.step();

  return (
    <>
      <Network network={network} />
      <Button onClick={step}>Step</Button>
      <ToggleWalkButton onClick={step} />
    </>
  );
}
