import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import StarIcon from '@mui/icons-material/Star';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import EditIcon from '@mui/icons-material/Edit';
import LabelIcon from '@mui/icons-material/Label';
import RateReviewIcon from '@mui/icons-material/RateReview';
import { useAuth } from '../contexts/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

type Activity = {
  activity_id: string;
  type: string;
  points: number;
  created_at: string;
  location: {
    id: string;
    name: string;
  } | null;
  metadata: Record<string, unknown>;
};

type UserProfile = {
  user: {
    user_id: string;
    email: string;
    display_name: string | null;
    reputation_score: number;
    created_at: string;
  };
  stats: {
    locations_added: number;
    locations_edited: number;
    tags_edited: number;
    ratings_added: number;
    total_contributions: number;
  };
  recent_activities: Activity[];
};

const activityIcons: Record<string, React.ReactNode> = {
  add_location: <AddLocationIcon />,
  edit_location: <EditIcon />,
  edit_tags: <LabelIcon />,
  add_rating: <RateReviewIcon />,
};

const activityLabels: Record<string, string> = {
  add_location: 'Added Location',
  edit_location: 'Edited Location',
  edit_tags: 'Updated Tags',
  add_rating: 'Added Rating',
};

const UserProfile = () => {
  const { user: authUser, token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!authUser) {
        setError('Please log in to view your profile');
        setLoading(false);
        return;
      }

      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}/api/users/${authUser.user_id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          setError('Failed to load profile');
        }
      } catch {
        setError('Error fetching profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [authUser, token]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Box p={2}>
        <Alert severity="error">{error || 'Unable to load profile'}</Alert>
      </Box>
    );
  }

  const memberSince = new Date(profile.user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
      {/* User Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '2rem' }}>
              {(profile.user.display_name || profile.user.email)[0].toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" gutterBottom>
                {profile.user.display_name || 'Anonymous User'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Member since {memberSince}
              </Typography>
            </Box>
            <Chip
              icon={<StarIcon />}
              label={`${profile.user.reputation_score} points`}
              color="primary"
              sx={{ fontSize: '1rem', p: 2 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <Typography variant="h6" gutterBottom>
        Contribution Statistics
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <AddLocationIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{profile.stats.locations_added}</Typography>
            <Typography variant="body2" color="text.secondary">
              Locations Added
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <EditIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{profile.stats.locations_edited}</Typography>
            <Typography variant="body2" color="text.secondary">
              Locations Edited
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <LabelIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{profile.stats.tags_edited}</Typography>
            <Typography variant="body2" color="text.secondary">
              Tags Updated
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <StarIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{profile.stats.total_contributions}</Typography>
            <Typography variant="body2" color="text.secondary">
              Total Contributions
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Recent Activity */}
      <Typography variant="h6" gutterBottom>
        Recent Activity
      </Typography>
      <Card>
        <CardContent>
          {profile.recent_activities.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No activity yet. Start contributing to earn points!
            </Typography>
          ) : (
            <List>
              {profile.recent_activities.map((activity, index) => {
                const activityDate = new Date(activity.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <ListItem
                    key={activity.activity_id}
                    divider={index < profile.recent_activities.length - 1}
                    sx={{ alignItems: 'flex-start' }}
                  >
                    <Box sx={{ mr: 2, mt: 1 }}>
                      {activityIcons[activity.type] || <StarIcon />}
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body1">
                            {activityLabels[activity.type] || activity.type}
                            {activity.location && (
                              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                • {activity.location.name}
                              </Typography>
                            )}
                          </Typography>
                          <Chip
                            label={`+${activity.points} pts`}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={activityDate}
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Points Legend */}
      <Card sx={{ mt: 3, bgcolor: 'info.light' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            How to Earn Points:
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Chip label="Add Location: +10 pts" size="small" />
            <Chip label="Edit Location: +5 pts" size="small" />
            <Chip label="Update Tags: +3 pts" size="small" />
            <Chip label="Add Rating: +2 pts" size="small" />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserProfile;
