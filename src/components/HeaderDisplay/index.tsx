import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faPencilAlt,
  faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';

import { getSemesterName } from '../../utils/semesters';
import { Button, Select, Tab } from '..';
import { LoadingSelect, SelectAction } from '../Select';
import Spinner from '../Spinner';
import { getNextVersionName } from '../../utils/misc';
import { DESKTOP_BREAKPOINT, LARGE_MOBILE_BREAKPOINT } from '../../constants';
import useScreenWidth from '../../hooks/useScreenWidth';
import HeaderActionBar from '../HeaderActionBar';
import useFeatureFlag from '../../hooks/useFeatureFlag';
import Modal from '../Modal';

import './stylesheet.scss';

type VersionState =
  | { type: 'loading' }
  | {
      type: 'loaded';
      currentVersionIndex: number;
      allVersionNames: readonly string[];
      setCurrentVersion: (nextIndex: number) => void;
      addNewVersion: (name: string, select?: boolean) => void;
      deleteVersion: (index: number) => void;
      renameVersion: (index: number, newName: string) => void;
    };

export type HeaderDisplayProps = {
  totalCredits?: number | null;
  currentTab: number;
  onChangeTab: (newTab: number) => void;
  onToggleMenu: () => void;
  tabs: string[];
  onCopyCrns?: () => void;
  enableCopyCrns?: boolean;
  onExportCalendar?: () => void;
  enableExportCalendar?: boolean;
  onDownloadCalendar?: () => void;
  enableDownloadCalendar?: boolean;
  termsState:
    | { type: 'loading' }
    | {
        type: 'loaded';
        terms: readonly string[];
        currentTerm: string;
        onChangeTerm: (next: string) => void;
      };
  versionsState: VersionState;
};

/**
 * Renders the top header component as a simple display component,
 * letting any substantive state be passed in as props.
 * See `<Header>` for the full implementation that owns the header state.
 * This is safe to render without `ScheduleContext` or `TermsContext`
 * being present.
 */
export default function HeaderDisplay({
  totalCredits = null,
  currentTab,
  onChangeTab,
  onToggleMenu,
  tabs,
  onCopyCrns = (): void => undefined,
  enableCopyCrns = false,
  onExportCalendar = (): void => undefined,
  enableExportCalendar = false,
  onDownloadCalendar = (): void => undefined,
  enableDownloadCalendar = false,
  termsState,
  versionsState,
}: HeaderDisplayProps): React.ReactElement {
  // Re-render when the page is re-sized to become mobile/desktop
  // (desktop is >= 1024 px wide)
  const mobile = !useScreenWidth(DESKTOP_BREAKPOINT);

  // Re-render when the page is re-sized to be small mobile vs. greater
  // (small mobile is < 600 px wide)
  const largeMobile = useScreenWidth(LARGE_MOBILE_BREAKPOINT);
  return (
    <div className="Header">
      {/* Menu button, only displayed on mobile */}
      {mobile && (
        <Button className="nav-menu-button" onClick={onToggleMenu}>
          <FontAwesomeIcon className="icon" fixedWidth icon={faBars} />
        </Button>
      )}

      {/* Left-aligned logo */}
      <Button className="logo">
        <span className="gt">GT </span>
        <span className="scheduler">Scheduler</span>
      </Button>

      {/* Term selector */}
      {termsState.type === 'loaded' ? (
        <Select
          onChange={termsState.onChangeTerm}
          current={termsState.currentTerm}
          options={termsState.terms.map((currentTerm) => ({
            id: currentTerm,
            label: getSemesterName(currentTerm),
          }))}
          className="semester"
        />
      ) : (
        <LoadingSelect />
      )}

      {/* Version selector */}
      <VersionSelector state={versionsState} />

      <span className="credits">
        {totalCredits === null ? (
          <Spinner size="small" style={{ marginRight: 8 }} />
        ) : (
          totalCredits
        )}{' '}
        Credits
      </span>

      {/* Include middle-aligned tabs on desktop */}
      {!mobile && (
        <div className="tabs">
          {tabs.map((tabLabel, tabIdx) => (
            <Tab
              key={tabIdx}
              active={tabIdx === currentTab}
              onClick={(): void => onChangeTab(tabIdx)}
              label={tabLabel}
            />
          ))}
        </div>
      )}

      {/* Include action bar on large mobile and higher */}
      {largeMobile && (
        <HeaderActionBar
          onCopyCrns={onCopyCrns}
          enableCopyCrns={enableCopyCrns}
          onExportCalendar={onExportCalendar}
          enableExportCalendar={enableExportCalendar}
          onDownloadCalendar={onDownloadCalendar}
          enableDownloadCalendar={enableDownloadCalendar}
        />
      )}
    </div>
  );
}

// Private sub-components

type VersionSelectorProps = {
  state: VersionState;
};

/**
 * Allows users to:
 * - switch between existing schedule versions
 * - add new blank versions with default (Primary, Secondary, etc.) names
 * - delete and rename existing versions.
 * Note that this functionality is currently hidden behind a feature flag
 * (pending a future feature release closer to schedules releasing):
 * Run the following command in the browser console and then refresh:
 *
 * ```
 * window.localStorage.setItem('ff-2021-09-14-schedule-versions', 'true')
 * ```
 */
function VersionSelector({
  state,
}: VersionSelectorProps): React.ReactElement | null {
  // Manage the delete confirmation state,
  // used to show a modal when it is non-null.
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const isEnabled = useFeatureFlag('2021-09-14', 'schedule-versions');
  if (!isEnabled) return null;

  if (state.type === 'loading') {
    return <LoadingSelect />;
  }

  return (
    <>
      <Select
        className="version-switch"
        desiredItemWidth={260}
        newLabel="New Schedule"
        onChange={state.setCurrentVersion}
        current={state.currentVersionIndex}
        options={state.allVersionNames.map((version, i) => {
          const actions: SelectAction<number>[] = [];

          // Add the edit (rename) action
          actions.push({
            type: 'edit',
            icon: faPencilAlt,
            onCommit: (newName: string) => {
              state.renameVersion(i, newName);
              return true;
            },
          });

          // Add the delete action
          if (state.allVersionNames.length >= 2) {
            actions.push({
              type: 'button',
              icon: faTrashAlt,
              onClick: () => {
                // Display a confirmation dialog before deleting the version
                setDeleteConfirm(i);
              },
            });
          }

          return {
            id: i,
            label: version,
            actions,
          };
        })}
        onClickNew={(): void => {
          // Handle creating a new version with the auto-generated name
          // (like 'Primary' or 'Secondary')
          state.addNewVersion(getNextVersionName(state.allVersionNames), true);
        }}
      />

      <Modal
        show={deleteConfirm != null}
        onHide={(): void => setDeleteConfirm(null)}
        buttons={[
          {
            label: 'Cancel',
            cancel: true,
            onClick: (): void => setDeleteConfirm(null),
          },
          {
            label: 'Delete',
            onClick: (): void => {
              if (deleteConfirm != null) {
                state.deleteVersion(deleteConfirm);
              }
              setDeleteConfirm(null);
            },
          },
        ]}
        // Use this because we use the same state as the show prop
        // to determine the contents of the children.
        // This prevents the children from flashing
        // a different value when the modal is disappearing.
        preserveChildrenWhileHiding
      >
        <div style={{ textAlign: 'center' }}>
          <h2>Delete confirmation</h2>
          <p>
            Are you sure you want to delete schedule &ldquo;
            {state.allVersionNames[deleteConfirm ?? 0] ?? '<unknown>'}&rdquo;?
          </p>
        </div>
      </Modal>
    </>
  );
}