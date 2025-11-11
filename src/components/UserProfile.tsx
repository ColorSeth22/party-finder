import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import CelebrationIcon from '@mui/icons-material/Celebration';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import { useAuth } from '../contexts/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

type Props = {
  open: boolean;
  onClose: () => void;
};

type Activity = {
  activity_id: string;
  type: string;
  points: number;
  created_at: string;
  event: {
    id: string;
    title: string;
    start_time: string;
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
    events_created: number;
    upcoming_events_hosting: number;
    checkins_made: number;
    favorites_saved: number;
    total_contributions: number;
  };
  recent_activities: Activity[];
};

const activityIcons: Record<string, ReactNode> = {
  add_event: <CelebrationIcon />,
  edit_event: <EditIcon />,
  check_in: <CheckCircleIcon />,
  favorite_event: <FavoriteIcon />
};

const activityLabels: Record<string, string> = {
  add_event: 'Hosted Event',
  edit_event: 'Updated Event',
  check_in: 'Checked In',
  favorite_event: 'Favorited Event'
};

const UserProfile = ({ open, onClose }: Props) => {
  const { user: authUser, token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allowDataCollection, setAllowDataCollection] = useState(false);
  const [updatingPreference, setUpdatingPreference] = useState(false);

  useEffect(() => {
    let ignore = false;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      setProfile(null);

      if (!authUser) {
        if (!ignore) {
          setError('Please log in to view your profile');
          setAllowDataCollection(false);
          setLoading(false);
        }
        return;
      }

      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const [profileRes, prefRes] = await Promise.all([
          fetch(`${API_BASE}/api/users/${authUser.user_id}`, { headers }),
          fetch(`${API_BASE}/api/users/data-collection`, { headers })
        ]);

        if (!ignore) {
          if (profileRes.ok) {
            const data = (await profileRes.json()) as UserProfile;
            setProfile(data);
          } else if (profileRes.status === 401) {
            setError('Session expired. Please log in again.');
          } else if (profileRes.status === 404) {
            setError('We could not find your profile.');
          } else {
            setError('Failed to load profile');
          }

          if (prefRes.ok) {
            const prefData = await prefRes.json();
            setAllowDataCollection(Boolean(prefData.allow_data_collection));
          } else if (prefRes.status === 401) {
            setAllowDataCollection(false);
          }
        }
      } catch (fetchError) {
        if (!ignore) {
          console.error('Error fetching profile', fetchError);
          setError('Error fetching profile');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    if (open) {
      fetchProfile();
    }

    return () => {
      ignore = true;
    };
  }, [open, authUser, token]);

  const handleDataCollectionToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setUpdatingPreference(true);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/users/data-collection`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ allow_data_collection: newValue })
      });

      if (res.ok) {
        setAllowDataCollection(newValue);
      } else {
        setError('Failed to update preference');
      }
    } catch {
      setError('Error updating preference');
    } finally {
      setUpdatingPreference(false);
    }
  };

  const activityItems = useMemo(() => {
    if (!profile) return [] as ReactNode[];

    return profile.recent_activities.map((activity, index) => {
      const activityDate = new Date(activity.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const eventTimestamp = activity.event?.start_time
        ? new Date(activity.event.start_time).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : null;

      return (
        <ListItem
          key={activity.activity_id}
          divider={index < profile.recent_activities.length - 1}
          sx={{ alignItems: 'flex-start' }}
        >
          <Box sx={{ mr: 2, mt: 1 }}>{activityIcons[activity.type] ?? <StarIcon />}</Box>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {activityLabels[activity.type] || activity.type}
                  {activity.event && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      • {activity.event.title}
                    </Typography>
                  )}
                </Typography>
                <Chip label={`+${activity.points} pts`} size="small" color="success" variant="outlined" />
              </Box>
            }
            secondary={eventTimestamp ? `${activityDate} • ${eventTimestamp}` : activityDate}
          />
        </ListItem>
      );
    });
  }, [profile]);

  if (!open) {
    return null;
  }

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !profile) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          User Profile
          <IconButton
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error">{error || 'Unable to load profile'}</Alert>
        </DialogContent>
      </Dialog>
    );
  }

  const memberSince = new Date(profile.user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        User Profile
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box>
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
                <Chip icon={<StarIcon />} label={`${profile.user.reputation_score} points`} color="primary" sx={{ fontSize: '1rem', py: 1 }} />
              </Box>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <Typography variant="h6" gutterBottom>
            Contribution Snapshot
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <CelebrationIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{profile.stats.events_created}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Events Hosted
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <EventAvailableIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{profile.stats.upcoming_events_hosting}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Upcoming Hosting
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <CheckCircleIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{profile.stats.checkins_made}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Check-ins
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <FavoriteIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{profile.stats.favorites_saved}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Favorites Saved
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
                  No activity yet. Host an event or check in to start earning points!
                </Typography>
              ) : (
                <List>{activityItems}</List>
              )}
            </CardContent>
          </Card>

          {/* Points Legend */}
          <Card sx={{ mt: 3, bgcolor: 'info.light' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                How to Earn Points
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Chip label="Host Event: +10 pts" size="small" />
                <Chip label="Update Event: +5 pts" size="small" />
                <Chip label="Check In: +2 pts" size="small" />
                <Chip label="Favorite Event: +1 pt" size="small" />
              </Stack>
            </CardContent>
          </Card>

          {/* Data Collection Opt-In */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <PeopleIcon color="primary" sx={{ mt: 0.5 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Help the Community
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Share anonymous crowd data so partygoers know what to expect. When enabled, you can submit quick updates about how busy your event is and earn bonus points.
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={allowDataCollection}
                        onChange={handleDataCollectionToggle}
                        disabled={updatingPreference}
                      />
                    }
                    label={allowDataCollection ? 'Data collection enabled' : 'Enable data collection'}
                  />
                  {allowDataCollection && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                      Thanks for contributing! You can now report occupancy levels straight from event pages.
                    </Alert>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfile;
