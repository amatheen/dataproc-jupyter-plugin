import React, { useState } from 'react';
import { JupyterLab } from '@jupyterlab/application';
import { IThemeManager } from '@jupyterlab/apputils';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { DataprocWidget } from '../controls/DataprocWidget';

interface IFormErrors {
  name?: string;
  features?: string;
  targetDate?: string;
}

export const NewFormComponent = ({
  app
}: {
  app: JupyterLab;
}): React.JSX.Element => {
  const [name, setName] = useState<string>('');
  const [environment, setEnvironment] = useState<string>('Development');
  const [features, setFeatures] = useState<{
    autoscaling: boolean;
    logging: boolean;
    highAvailability: boolean;
  }>({
    autoscaling: false,
    logging: false,
    highAvailability: false
  });
  const [targetDate, setTargetDate] = useState<string>('');
  const [errors, setErrors] = useState<IFormErrors>({});

  const getTodayString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const validate = (): boolean => {
    const newErrors: IFormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required and cannot be empty.';
    }

    const hasSelectedFeature = Object.values(features).some(Boolean);
    if (!hasSelectedFeature) {
      newErrors.features = 'Please select at least one feature.';
    }

    if (!targetDate) {
      newErrors.targetDate = 'Target Execution Date is required.';
    } else if (targetDate < getTodayString()) {
      newErrors.targetDate = 'Target Execution Date cannot be in the past.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFeatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name: featureName, checked } = event.target;
    setFeatures(prev => ({
      ...prev,
      [featureName]: checked
    }));
    if (errors.features) {
      setErrors(prev => ({ ...prev, features: undefined }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    await app.commands.execute('apputils:notify', {
      message: 'Data saved successfully',
      type: 'success',
      options: {
        autoClose: 3000
      }
    });

    app.shell.activeWidget?.close();
  };

  const handleCancel = () => {
    app.shell.activeWidget?.close();
  };

  return (
    <div className="component-level">
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ maxWidth: 520, p: 4 }}
      >
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 500 }}>
          New Form XYZ
        </Typography>

        <Stack spacing={3}>
          {/* Name Field */}
          <TextField
            label="Name"
            required
            fullWidth
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (errors.name) {
                setErrors(prev => ({ ...prev, name: undefined }));
              }
            }}
            error={Boolean(errors.name)}
            helperText={errors.name}
          />

          {/* Environment Type Radio Buttons */}
          <FormControl>
            <FormLabel id="environment-type-label">Environment Type</FormLabel>
            <RadioGroup
              aria-labelledby="environment-type-label"
              name="environment-type"
              value={environment}
              onChange={e => setEnvironment(e.target.value)}
            >
              <FormControlLabel
                value="Development"
                control={<Radio size="small" />}
                label="Development"
              />
              <FormControlLabel
                value="Staging"
                control={<Radio size="small" />}
                label="Staging"
              />
              <FormControlLabel
                value="Production"
                control={<Radio size="small" />}
                label="Production"
              />
            </RadioGroup>
          </FormControl>

          {/* Features / Options Checkboxes */}
          <FormControl
            required
            error={Boolean(errors.features)}
            component="fieldset"
          >
            <FormLabel component="legend">Features / Options</FormLabel>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={features.autoscaling}
                    onChange={handleFeatureChange}
                    name="autoscaling"
                  />
                }
                label="Enable Autoscaling"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={features.logging}
                    onChange={handleFeatureChange}
                    name="logging"
                  />
                }
                label="Enable Logging"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={features.highAvailability}
                    onChange={handleFeatureChange}
                    name="highAvailability"
                  />
                }
                label="Enable High Availability"
              />
            </FormGroup>
            {errors.features && (
              <FormHelperText>{errors.features}</FormHelperText>
            )}
          </FormControl>

          {/* Target Execution Date */}
          <TextField
            label="Target Execution Date"
            type="date"
            required
            fullWidth
            value={targetDate}
            onChange={e => {
              setTargetDate(e.target.value);
              if (errors.targetDate) {
                setErrors(prev => ({ ...prev, targetDate: undefined }));
              }
            }}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: getTodayString() }}
            error={Boolean(errors.targetDate)}
            helperText={errors.targetDate}
          />

          {/* Action Buttons */}
          <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
            <Button type="submit" variant="contained" color="primary">
              SUBMIT
            </Button>
            <Button type="button" variant="outlined" onClick={handleCancel}>
              CANCEL
            </Button>
          </Stack>
        </Stack>
      </Box>
    </div>
  );
};

export class NewFormWidget extends DataprocWidget {
  app: JupyterLab;

  constructor(app: JupyterLab, themeManager: IThemeManager) {
    super(themeManager);
    this.app = app;
  }

  renderInternal(): React.JSX.Element {
    return <NewFormComponent app={this.app} />;
  }
}
