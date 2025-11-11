import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import { useSettings } from '../contexts/settings/hooks';
import type { DistanceUnit, ThemeMode, ColorScheme } from '../contexts/settings/types';
import { TAGS } from '../data/tags';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedTags: string[];
  onApplyFilters: (tags: string[]) => void;
}

const colorSchemeOptions: Array<{ value: ColorScheme; label: string; color: string }> = [
  { value: 'orange', label: 'Orange', color: '#ff6b35' },
  { value: 'pink', label: 'Pink', color: '#e91e63' },
  { value: 'purple', label: 'Purple', color: '#9c27b0' },
  { value: 'blue', label: 'Blue', color: '#2196f3' },
  { value: 'green', label: 'Green', color: '#4caf50' },
  { value: 'red', label: 'Red', color: '#f44336' },
];

const SettingsDialog = ({ open, onClose, selectedTags, onApplyFilters }: SettingsDialogProps) => {
  const { 
    distanceUnit, 
    setDistanceUnit, 
    themeMode, 
    setThemeMode,
    colorScheme,
    setColorScheme,
    showDistanceLabels,
    setShowDistanceLabels,
    autoRefresh,
    setAutoRefresh
  } = useSettings();
  
  const [localUnit, setLocalUnit] = useState<DistanceUnit>(distanceUnit);
  const [localTheme, setLocalTheme] = useState<ThemeMode>(themeMode);
  const [localColorScheme, setLocalColorScheme] = useState<ColorScheme>(colorScheme);
  const [localShowDistance, setLocalShowDistance] = useState(showDistanceLabels);
  const [localAutoRefresh, setLocalAutoRefresh] = useState(autoRefresh);
  const [localTags, setLocalTags] = useState<string[]>(selectedTags);

  useEffect(() => {
    if (open) {
      setLocalUnit(distanceUnit);
      setLocalTheme(themeMode);
      setLocalColorScheme(colorScheme);
      setLocalShowDistance(showDistanceLabels);
      setLocalAutoRefresh(autoRefresh);
      setLocalTags(selectedTags);
    }
  }, [open, distanceUnit, themeMode, colorScheme, showDistanceLabels, autoRefresh, selectedTags]);

  const toggleTag = (tag: string) => {
    setLocalTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => setLocalTags([]);

  const handleSave = () => {
    setDistanceUnit(localUnit);
    setThemeMode(localTheme);
    setColorScheme(localColorScheme);
    setShowDistanceLabels(localShowDistance);
    setAutoRefresh(localAutoRefresh);
    onApplyFilters(localTags);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Settings & Preferences</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <div>
            <FormLabel id="theme-mode">Theme</FormLabel>
            <RadioGroup
              aria-labelledby="theme-mode"
              value={localTheme}
              onChange={(e) => setLocalTheme(e.target.value as ThemeMode)}
              row
            >
              <FormControlLabel value="light" control={<Radio />} label="Light" />
              <FormControlLabel value="dark" control={<Radio />} label="Dark" />
              <FormControlLabel value="auto" control={<Radio />} label="Auto" />
            </RadioGroup>
          </div>

          <Divider />

          <div>
            <FormLabel id="color-scheme">Color Scheme</FormLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              {colorSchemeOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  onClick={() => setLocalColorScheme(option.value)}
                  variant={localColorScheme === option.value ? 'filled' : 'outlined'}
                  sx={{
                    bgcolor: localColorScheme === option.value ? option.color : 'transparent',
                    color: localColorScheme === option.value ? '#fff' : 'inherit',
                    borderColor: option.color,
                    '&:hover': {
                      bgcolor: localColorScheme === option.value ? option.color : `${option.color}20`,
                    },
                  }}
                />
              ))}
            </Box>
          </div>

          <Divider />

          <div>
            <FormLabel id="distance-units">Distance units</FormLabel>
            <RadioGroup
              aria-labelledby="distance-units"
              value={localUnit}
              onChange={(e) => setLocalUnit(e.target.value as DistanceUnit)}
              row
            >
              <FormControlLabel value="km" control={<Radio />} label="Kilometers" />
              <FormControlLabel value="mi" control={<Radio />} label="Miles" />
            </RadioGroup>
          </div>

          <Divider />

          <div>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Display Options
            </Typography>
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={localShowDistance} 
                    onChange={(e) => setLocalShowDistance(e.target.checked)} 
                  />
                }
                label="Show distance labels on map"
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={localAutoRefresh} 
                    onChange={(e) => setLocalAutoRefresh(e.target.checked)} 
                  />
                }
                label="Auto-refresh events (every 30s)"
              />
            </Stack>
          </div>

          <Divider />

          <div>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Event Filters
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {TAGS.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onClick={() => toggleTag(tag)}
                  color={localTags.includes(tag) ? 'primary' : 'default'}
                  variant={localTags.includes(tag) ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </div>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button color="inherit" onClick={clearFilters}>Clear filters</Button>
        <Box>
          <Button onClick={onClose} sx={{ mr: 1 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;
