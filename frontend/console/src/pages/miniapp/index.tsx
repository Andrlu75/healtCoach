import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MiniAppLayout } from './MiniAppLayout';
import { MiniAppWorkouts } from './MiniAppWorkouts';
import { MiniAppWorkoutDetail } from './MiniAppWorkoutDetail';
import { MiniAppWorkoutRun } from './MiniAppWorkoutRun';
import { FadeTransition } from './components/ScreenTransition';

type Screen = 'list' | 'detail' | 'run';
type TabId = 'home' | 'diary' | 'stats' | 'workouts' | 'profile';

interface MiniAppWorkoutsPageProps {
  clientId: string;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-30%',
    opacity: direction > 0 ? 1 : 0.5,
    scale: direction > 0 ? 1 : 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-30%' : '100%',
    opacity: direction > 0 ? 0.5 : 1,
    scale: direction > 0 ? 0.95 : 1,
  }),
};

// This is the main entry point for the "Workouts" tab in your Telegram Mini App
// You can integrate this into your existing Mini App navigation
export const MiniAppWorkoutsPage = ({ clientId }: MiniAppWorkoutsPageProps) => {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const directionRef = useRef(1);

  const handleWorkoutClick = (workoutId: string, assignmentId: string) => {
    directionRef.current = 1;
    setSelectedWorkoutId(workoutId);
    setSelectedAssignmentId(assignmentId);
    setScreen('detail');
  };

  const handleStartWorkout = () => {
    directionRef.current = 1;
    setScreen('run');
  };

  const handleBack = () => {
    directionRef.current = -1;
    if (screen === 'run') {
      setScreen('detail');
    } else {
      setScreen('list');
      setSelectedWorkoutId(null);
      setSelectedAssignmentId(null);
    }
  };

  const handleComplete = () => {
    directionRef.current = -1;
    setScreen('list');
    setSelectedWorkoutId(null);
    setSelectedAssignmentId(null);
  };

  const getScreenKey = () => {
    if (screen === 'list') return 'list';
    if (screen === 'detail') return `detail-${selectedWorkoutId}`;
    return `run-${selectedWorkoutId}`;
  };

  return (
    <div className="overflow-hidden">
      <AnimatePresence mode="wait" custom={directionRef.current}>
        <motion.div
          key={getScreenKey()}
          custom={directionRef.current}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            type: 'spring',
            stiffness: 350,
            damping: 30,
            mass: 0.8,
          }}
        >
          {screen === 'list' && (
            <MiniAppWorkouts
              clientId={clientId}
              onWorkoutClick={handleWorkoutClick}
            />
          )}
          {screen === 'detail' && selectedWorkoutId && selectedAssignmentId && (
            <MiniAppWorkoutDetail
              workoutId={selectedWorkoutId}
              assignmentId={selectedAssignmentId}
              onBack={handleBack}
              onStartWorkout={handleStartWorkout}
            />
          )}
          {screen === 'run' && selectedWorkoutId && selectedAssignmentId && (
            <MiniAppWorkoutRun
              workoutId={selectedWorkoutId}
              assignmentId={selectedAssignmentId}
              onBack={handleBack}
              onComplete={handleComplete}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// Demo page with layout - use this for testing
// In your real Mini App, integrate MiniAppWorkoutsPage into your existing navigation
export const MiniAppDemo = () => {
  const [activeTab, setActiveTab] = useState<TabId>('workouts');

  // For demo purposes, using a hardcoded client ID
  // In production, get this from Telegram user auth or URL params
  const demoClientId = '1';

  return (
    <MiniAppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <FadeTransition screenKey={activeTab}>
        {activeTab === 'workouts' && (
          <MiniAppWorkoutsPage clientId={demoClientId} />
        )}
        {activeTab === 'home' && (
          <div className="text-center py-16 text-gray-500">
            <p>Главная страница</p>
            <p className="text-sm mt-2">Ваш контент КБЖУ</p>
          </div>
        )}
        {activeTab === 'diary' && (
          <div className="text-center py-16 text-gray-500">
            <p>Дневник питания</p>
          </div>
        )}
        {activeTab === 'stats' && (
          <div className="text-center py-16 text-gray-500">
            <p>Статистика</p>
          </div>
        )}
        {activeTab === 'profile' && (
          <div className="text-center py-16 text-gray-500">
            <p>Профиль</p>
          </div>
        )}
      </FadeTransition>
    </MiniAppLayout>
  );
};

export default MiniAppDemo;
