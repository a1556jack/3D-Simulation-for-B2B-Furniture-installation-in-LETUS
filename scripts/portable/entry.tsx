import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../../src/components/workspace';
import '../../src/app/globals.css';
createRoot(document.getElementById('root')!).render(<Workspace/>);
