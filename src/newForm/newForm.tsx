import React, { useEffect, useState } from 'react';
import { JupyterLab } from '@jupyterlab/application';
import { IThemeManager, Notification } from '@jupyterlab/apputils';
import { DataprocWidget } from '../controls/DataprocWidget';
// Backend API utilities for fetching GCP credentials, projects, and regions
import { authApi } from '../utils/utils';
import { projectListAPI } from '../utils/projectService';
import { useRegion } from '../utils/regionService';
import '../../style/newForm.css';

/**
 * Regex validation for the Name field:
 * Must start with a lowercase letter, contain only lowercase letters, numbers,
 * or hyphens, be 3–63 characters long, and end with a letter or number.
 */
const NAME_REGEX = /^[a-z][a-z0-9-]{1,61}[a-z0-9]$/;

interface IFormErrors {
  name?: string;
  projectId?: string;
  region?: string;
  features?: string;
  targetDate?: string;
}

export const NewFormComponent = ({
  app
}: {
  app: JupyterLab;
}): React.JSX.Element => {
  const [name, setName] = useState<string>('');
  const [nameTouched, setNameTouched] = useState<boolean>(false);
  // State for Project ID and Region populated from backend APIs
  const [projectId, setProjectId] = useState<string>('');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);
  const [region, setRegion] = useState<string>('');

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

  // Hook that fetches available GCP regions for the selected projectId from backend API
  const regions = useRegion(projectId);

  // Fetch initial project_id/region_id from auth credentials and the full project list on mount
  useEffect(() => {
    let isMounted = true;
    const loadInitialProjectAndRegion = async () => {
      setIsLoadingProjects(true);
      try {
        const [credentials, projects] = await Promise.all([
          authApi(),
          projectListAPI('')
        ]);
        if (!isMounted) {
          return;
        }
        if (credentials?.project_id) {
          setProjectId(credentials.project_id);
          // Ensure the currently configured project is included in the dropdown options
          if (!projects.includes(credentials.project_id)) {
            setProjectList([credentials.project_id, ...projects]);
          } else {
            setProjectList(projects);
          }
        } else {
          setProjectList(projects);
        }
        if (credentials?.region_id) {
          setRegion(credentials.region_id);
        }
      } catch (error) {
        console.error('Failed to load project/region configuration:', error);
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    };

    loadInitialProjectAndRegion();
    return () => {
      isMounted = false;
    };
  }, []);

  const getTodayString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Validate Name against non-empty and regex requirements
  const validateName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Name is required and cannot be empty.';
    }
    if (!NAME_REGEX.test(trimmed)) {
      return 'Name must be 3–63 characters, start with a lowercase letter, end with a letter or number, and contain only lowercase letters, numbers, or hyphens.';
    }
    return undefined;
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setName(newValue);
    setErrors(prev => ({
      ...prev,
      name: validateName(newValue)
    }));
  };

  // Update Project ID and reset Region when a new project is selected
  const handleProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newProjectId = event.target.value;
    setProjectId(newProjectId);
    setRegion('');
    setErrors(prev => ({
      ...prev,
      projectId: newProjectId ? undefined : 'Project ID is required.'
    }));
  };

  const handleRegionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newRegion = event.target.value;
    setRegion(newRegion);
    setErrors(prev => ({
      ...prev,
      region: newRegion ? undefined : 'Region is required.'
    }));
  };

  const handleFeatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name: featureName, checked } = event.target;
    const updatedFeatures = {
      ...features,
      [featureName]: checked
    };
    setFeatures(updatedFeatures);
    const hasSelectedFeature = Object.values(updatedFeatures).some(Boolean);
    setErrors(prev => ({
      ...prev,
      features: hasSelectedFeature
        ? undefined
        : '* At least one feature needs to be chosen'
    }));
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    setTargetDate(newDate);
    let dateError: string | undefined;
    if (!newDate) {
      dateError = 'Target Execution Date is required.';
    } else if (newDate < getTodayString()) {
      dateError = 'Target Execution Date cannot be in the past.';
    }
    setErrors(prev => ({
      ...prev,
      targetDate: dateError
    }));
  };

  // Keep Submit button disabled by default until all field validations pass
  const isSubmitDisabled = (): boolean => {
    const isNameValid = NAME_REGEX.test(name.trim());
    const isProjectValid = projectId.trim() !== '';
    const isRegionValid = region.trim() !== '';
    const hasSelectedFeature = Object.values(features).some(Boolean);
    const isDateValid = targetDate !== '' && targetDate >= getTodayString();

    return !(
      isNameValid &&
      isProjectValid &&
      isRegionValid &&
      hasSelectedFeature &&
      isDateValid
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitDisabled()) {
      return;
    }

    // Show toast notification on submit
    Notification.emit('Data saved successfully', 'success', {
      autoClose: 3000
    });

    (app.shell.currentWidget ?? app.shell.activeWidget)?.close();
  };

  // Close the opened New Form XYZ tab and return to the Launcher on cancel
  const handleCancel = () => {
    (app.shell.currentWidget ?? app.shell.activeWidget)?.close();
  };

  const hasSelectedFeature = Object.values(features).some(Boolean);

  return (
    <div
      className="component-level new-form-page-wrapper"
      style={{ marginLeft: '24px' }}
    >
      {/* JupyterLab-style top header bar */}
      <div className="new-form-header-bar">
        <h2 className="new-form-header-title">New Form XYZ</h2>
      </div>

      {/* Native HTML form inside a JupyterLab-styled surface card */}
      <form
        className="new-form-container"
        onSubmit={handleSubmit}
        noValidate
      >
        <div
          className="new-form-stack"
          style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
        >
          {/* Name Field with Regex Validation and Red Suggestion Message */}
          <div className="new-form-field">
            <label className="new-form-label" htmlFor="new-form-name">
              Name<span className="new-form-required">*</span>
            </label>
            <input
              id="new-form-name"
              type="text"
              className={`new-form-input ${errors.name ? 'input-error' : ''}`}
              value={name}
              onFocus={() => setNameTouched(true)}
              onClick={() => setNameTouched(true)}
              onChange={handleNameChange}
              placeholder="e.g. my-dataproc-job-01"
              required
            />
            {nameTouched &&
              (errors.name ? (
                <div
                  className="new-form-error-text"
                  style={{ color: '#d93025' }}
                >
                  {errors.name}
                </div>
              ) : (
                !NAME_REGEX.test(name.trim()) && (
                  <div
                    className="new-form-name-suggestion"
                    style={{ color: '#d93025' }}
                  >
                    Lowercase letters, numbers, and hyphens allowed (3–63 chars,
                    must start with a lowercase letter and end with a letter or
                    number).
                  </div>
                )
              ))}
          </div>

          {/* Project ID Field populated via projectListAPI and authApi */}
          <div className="new-form-field">
            <label className="new-form-label" htmlFor="new-form-project">
              Project ID<span className="new-form-required">*</span>
            </label>
            <select
              id="new-form-project"
              className={`new-form-select ${errors.projectId ? 'input-error' : ''
                }`}
              value={projectId}
              onChange={handleProjectChange}
              disabled={isLoadingProjects}
              required
            >
              <option value="">
                {isLoadingProjects ? 'Loading projects...' : 'Select a Project'}
              </option>
              {projectList.map(proj => (
                <option key={proj} value={proj}>
                  {proj}
                </option>
              ))}
            </select>
            {errors.projectId && (
              <div className="new-form-error-text">{errors.projectId}</div>
            )}
          </div>

          {/* Region Field populated dynamically via useRegion(projectId) */}
          <div className="new-form-field">
            <label className="new-form-label" htmlFor="new-form-region">
              Region<span className="new-form-required">*</span>
            </label>
            <select
              id="new-form-region"
              className={`new-form-select ${errors.region ? 'input-error' : ''
                }`}
              value={region}
              onChange={handleRegionChange}
              disabled={!projectId || regions.length === 0}
              required
            >
              <option value="">
                {!projectId
                  ? 'Select a Project ID first'
                  : regions.length === 0
                    ? 'Loading regions...'
                    : 'Select a Region'}
              </option>
              {regions.map(reg => (
                <option key={reg.name} value={reg.name}>
                  {reg.name}
                </option>
              ))}
            </select>
            {errors.region && (
              <div className="new-form-error-text">{errors.region}</div>
            )}
          </div>

          {/* Environment Type Radio Buttons */}
          <div className="new-form-field">
            <span className="new-form-label">Environment Type</span>
            <div className="new-form-option-group" role="radiogroup">
              {['Development', 'Staging', 'Production'].map(envOption => (
                <label key={envOption} className="new-form-option-label">
                  <input
                    type="radio"
                    name="environment-type"
                    value={envOption}
                    checked={environment === envOption}
                    onChange={e => setEnvironment(e.target.value)}
                  />
                  {envOption}
                </label>
              ))}
            </div>
          </div>

          {/* Features / Options Checkboxes */}
          <div className="new-form-field">
            <span className="new-form-label">
              Features / Options<span className="new-form-required">*</span>
            </span>
            <div className="new-form-option-group">
              <label className="new-form-option-label">
                <input
                  type="checkbox"
                  name="autoscaling"
                  checked={features.autoscaling}
                  onChange={handleFeatureChange}
                />
                Enable Autoscaling
              </label>
              <label className="new-form-option-label">
                <input
                  type="checkbox"
                  name="logging"
                  checked={features.logging}
                  onChange={handleFeatureChange}
                />
                Enable Logging
              </label>
              <label className="new-form-option-label">
                <input
                  type="checkbox"
                  name="highAvailability"
                  checked={features.highAvailability}
                  onChange={handleFeatureChange}
                />
                Enable High Availability
              </label>
            </div>
            {(errors.features || !hasSelectedFeature) && (
              <div className="new-form-error-text" style={{ color: '#d93025' }}>
                {errors.features || '* At least one feature needs to be chosen'}
              </div>
            )}
          </div>

          {/* Target Execution Date */}
          <div className="new-form-field">
            <label className="new-form-label" htmlFor="new-form-target-date">
              Target Execution Date<span className="new-form-required">*</span>
            </label>
            <input
              id="new-form-target-date"
              type="date"
              className={`new-form-input ${errors.targetDate ? 'input-error' : ''
                }`}
              value={targetDate}
              min={getTodayString()}
              onChange={handleDateChange}
              required
            />
            {errors.targetDate && (
              <div className="new-form-error-text">{errors.targetDate}</div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="new-form-actions">
            <button
              type="submit"
              className="new-form-btn new-form-btn-submit"
              disabled={isSubmitDisabled()}
            >
              SUBMIT
            </button>
            <button
              type="button"
              className="new-form-btn new-form-btn-cancel"
              onClick={handleCancel}
            >
              CANCEL
            </button>
          </div>
        </div>
      </form>
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

