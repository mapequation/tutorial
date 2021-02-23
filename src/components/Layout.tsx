import React, { useState } from 'react';
import { Button, Grid, Header, Icon } from 'semantic-ui-react';
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
    network.walker.step();
  };

  return (
    <Grid>
      <Grid.Column width={8}>
        <Network network={network} showVisitRate={showVisitRate} />
        <br />
        <Header>Random walker</Header>
        <Button onClick={() => network.walker.reset()}>
          <Icon name="undo alternate" /> Reset
        </Button>
        <Button onClick={step} primary>
          <Icon name="step forward" />
          Step
        </Button>
        <ToggleWalkButton onClick={step} />
      </Grid.Column>
      <Grid.Column width={8}>
        <RateView network={network} />
        <CodeView network={network} />
      </Grid.Column>
    </Grid>
  );
}
