import React from 'react';
import './App.css';
import { Button } from 'semantic-ui-react';

interface AppProps {}

function App({}: AppProps) {
  return (
    <div className="App">
      <Button>Hello, World!</Button>
    </div>
  );
}

export default App;
