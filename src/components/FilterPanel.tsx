import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { TAGS } from '../data/tags';

type FilterPanelProps = {
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
};

const FilterPanel = ({ selectedTags, onTagToggle }: FilterPanelProps) => {
  return (
    <Box 
      sx={{ 
        p: 1.5,
        backgroundColor: 'white',
        borderRadius: 1,
        boxShadow: 2,
        maxWidth: { xs: 300, sm: 420 },
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Filter by tags
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {TAGS.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <Chip
              key={tag}
              label={tag}
              size="small"
              onClick={() => onTagToggle(tag)}
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default FilterPanel;
