import React, { useState } from 'react';
import { Button, Grid, Icon, Menu, Segment } from 'semantic-ui-react';
import type { Network as NetworkModel } from '../model';
import Network from './Network';
import ToggleWalkButton from './ToggleWalkButton';
import RateView from './RateView';
import CodeView from './CodeView';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [showVisitRate, setShowVisitRate] = useState(false);
  const [activeItem, _setActiveItem] = useState('rate view');

  const setActiveItem = (_: any, { name = '' }: { name?: string }) =>
    _setActiveItem(name);

  const step = () => {
    if (!showVisitRate) setShowVisitRate(true);
    network.walker.step();
  };

  return (
    <Grid>
      <Grid.Column width={8}>
        <Network network={network} showVisitRate={showVisitRate} />
        <br />
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
        <Menu>
          <Menu.Item
            name="rate view"
            active={activeItem === 'rate view'}
            onClick={setActiveItem}
          />
          <Menu.Item
            name="code view"
            active={activeItem === 'code view'}
            onClick={setActiveItem}
          />
        </Menu>
        <Segment basic>
          {activeItem === 'rate view' && <RateView network={network} />}
          {activeItem === 'code view' && <CodeView network={network} />}
        </Segment>
      </Grid.Column>
    </Grid>
  );
}
