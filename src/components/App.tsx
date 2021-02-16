import React from 'react';
import './App.css';
import { modular_wd, modular_wd_json } from '../networks';
import { Network } from './network';
import { Network as NetworkModel, pageRank, undirectedFlow } from '../model';
import { forceDirected } from '../layout';
import { Button } from 'semantic-ui-react';

interface AppProps {}

interface AppState {
  loading: boolean;
  network?: NetworkModel;
}

class App extends React.Component<AppProps> {
  state: AppState = {
    loading: true,
    network: undefined,
  };

  componentDidMount() {
    //const network = NetworkModel.deserialize(modular_wd);
    const network = NetworkModel.parse(modular_wd_json);

    console.log(network);
    const nodeFlow = network.directed
      ? pageRank(network.links)
      : undirectedFlow(network.links);

    for (const [id, flow] of Object.entries(nodeFlow)) {
      network.getNode(+id).flow = flow;
    }

    this.setState({ loading: false, network });

    /*forceDirected(network, 600, 600).then(() =>
      this.setState({
        loading: false,
        network,
      }),
    );*/
  }

  render() {
    const { loading, network } = this.state;

    return (
      <div className="App">
        {loading && <p>Loading...</p>}
        {!loading && network != null && (
          <>
            <Network network={network} />
            <Button onClick={() => network.walker.step()}>Step</Button>
          </>
        )}
      </div>
    );
  }
}

export default App;
