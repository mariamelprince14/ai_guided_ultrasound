import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@components/layout/AppLayout';
import { ModeSelection } from '@pages/ModeSelection';
import { SessionSetup } from '@pages/SessionSetup';
import { TrainingWorkspace } from '@pages/TrainingWorkspace';
import { FullTrainingPage } from '@pages/FullTrainingPage';
import { AssessmentPage } from '@pages/AssessmentPage';
import { IdentificationPage } from '@pages/IdentificationPage';
import { ProgressResults } from '@pages/ProgressResults';
import { SystemStatus } from '@pages/SystemStatus';
import { Help } from '@pages/Help';
import { RegistrationPage } from '@pages/RegistrationPage';
import '@styles/global.css';

console.log('App.tsx rendering...')

function App() {
  console.log('App component rendered')
  
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<ModeSelection />} />
          <Route path="/setup" element={<SessionSetup />} />
          <Route path="/workspace" element={<TrainingWorkspace />} />
          <Route path="/training/full" element={<FullTrainingPage />} />
          <Route path="/training/assessment" element={<AssessmentPage />} />
          <Route path="/training/identification" element={<IdentificationPage />} />
          <Route path="/results" element={<ProgressResults />} />
          <Route path="/status" element={<SystemStatus />} />
          <Route path="/help" element={<Help />} />
          <Route path="/registration" element={<RegistrationPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
