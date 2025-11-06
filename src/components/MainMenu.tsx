import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import MapIcon from '@mui/icons-material/Map';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import EditIcon from '@mui/icons-material/Edit';

type Props = {
  currentView: string;
  setView: (view: string) => void;
};

const MainMenu = ({ currentView, setView }: Props) => {
  const valueMap: Record<string, number> = { map: 0, add: 1, update: 2 };
  const reverseMap: Record<number, string> = { 0: 'map', 1: 'add', 2: 'update' };

  return (
    <Paper
      elevation={8}
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: 0 }}
    >
      <BottomNavigation
        showLabels
        value={valueMap[currentView] ?? 0}
        onChange={(_event, newValue) => setView(reverseMap[newValue])}
        sx={{
          height: 64,
          px: 1,
          bgcolor: 'background.paper',
        }}
      >
        <BottomNavigationAction
          label="Map"
          icon={<MapIcon />}
          sx={{
            '& .MuiBottomNavigationAction-label': { fontSize: '0.75rem' },
          }}
        />
        <BottomNavigationAction
          label="Add"
          icon={<AddLocationIcon />}
          sx={{
            '& .MuiBottomNavigationAction-label': { fontSize: '0.75rem' },
          }}
        />
        <BottomNavigationAction
          label="Edit"
          icon={<EditIcon />}
          sx={{
            '& .MuiBottomNavigationAction-label': { fontSize: '0.75rem' },
          }}
        />
      </BottomNavigation>
    </Paper>
  );
};

export default MainMenu;
