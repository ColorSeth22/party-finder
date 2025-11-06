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
import { useSettings } from '../contexts/settings/hooks';
import type { DistanceUnit } from '../contexts/settings/types';
import { TAGS } from '../data/tags';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedTags: string[];
  onApplyFilters: (tags: string[]) => void;
}

const SettingsDialog = ({ open, onClose, selectedTags, onApplyFilters }: SettingsDialogProps) => {
  const { distanceUnit, setDistanceUnit } = useSettings();
  const [localUnit, setLocalUnit] = useState<DistanceUnit>(distanceUnit);
  const [localTags, setLocalTags] = useState<string[]>(selectedTags);

  useEffect(() => {
    if (open) {
      setLocalUnit(distanceUnit);
      setLocalTags(selectedTags);
    }
  }, [open, distanceUnit, selectedTags]);

  const toggleTag = (tag: string) => {
    setLocalTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => setLocalTags([]);

  const handleSave = () => {
    setDistanceUnit(localUnit);
    onApplyFilters(localTags);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
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
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Filters
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
