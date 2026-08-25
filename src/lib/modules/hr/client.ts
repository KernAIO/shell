import { defineClientModule } from '@kernhq/ui'
import * as m from '$msg'
import { HR_CAPABILITIES, HR_PERMISSIONS } from './permissions'

/**
 * HR as the shell sees it.
 *
 * Every contribution carries two independent gates, and they answer different questions:
 *
 * - `permission` — may *this person* reach it. Someone else in the workspace may well see it.
 * - `capability` — does *this workspace* have the feature at all. When it is off nobody sees it,
 *   including an owner, and the API behind it answers 404 rather than 403.
 *
 * That second gate is why this module can be a staff directory for one company and a shift-rostering
 * system for another without a line of conditional code. A workspace that never switches attendance
 * on has no clock widget, no attendance nav, no schedule settings and no attendance commands — not
 * greyed out, not there.
 *
 * Labels are getters rather than strings because a module is defined once at import time while the
 * interface language can change afterwards; reading them on render keeps the rail and the palette in
 * the language the person actually chose.
 */
export const hrClientModule = defineClientModule({
  id: 'hr',
  name: 'People',
  icon: 'users',

  nav: [
    {
      id: 'hr',
      get label() {
        return m.hr_nav()
      },
      icon: 'users',
      href: '/hr',
      order: 30,
      permission: HR_PERMISSIONS.personView,
    },
  ],

  routes: [
    {
      path: '/hr/leave',
      component: () => import('./LeavePage.svelte'),
      get title() {
        return m.hr_leave_title()
      },
      permission: HR_PERMISSIONS.leaveView,
      capability: HR_CAPABILITIES.leave,
    },
    {
      path: '/hr/attendance',
      component: () => import('./AttendancePage.svelte'),
      get title() {
        return m.hr_attendance_title()
      },
      permission: HR_PERMISSIONS.attendanceView,
      capability: HR_CAPABILITIES.attendance,
    },
    {
      path: '/hr/approvals',
      component: () => import('./ApprovalsPage.svelte'),
      get title() {
        return m.hr_approvals_title()
      },
    },
    {
      path: '/hr/offices',
      component: () => import('./OfficesPage.svelte'),
      get title() {
        return m.hr_offices_title()
      },
      permission: HR_PERMISSIONS.officeView,
      capability: HR_CAPABILITIES.offices,
    },
    {
      // Last: the shell matches in order, and `/hr` would otherwise swallow the paths above it.
      path: '/hr',
      component: () => import('./DirectoryPage.svelte'),
      get title() {
        return m.hr_title()
      },
      permission: HR_PERMISSIONS.personView,
    },
  ],

  widgets: [
    {
      id: 'hr.clock',
      get title() {
        return m.hr_widget_clock_title()
      },
      get description() {
        return m.hr_widget_clock_desc()
      },
      icon: 'timer',
      permission: HR_PERMISSIONS.attendancePunch,
      capability: HR_CAPABILITIES.attendance,
      sizes: ['s', 'm'],
      defaultSize: 's',
      compact: true,
      order: 10,
      component: () => import('./widgets/ClockWidget.svelte'),
    },
    {
      id: 'hr.my-leave',
      get title() {
        return m.hr_widget_balance_title()
      },
      get description() {
        return m.hr_widget_balance_desc()
      },
      icon: 'tree-palm',
      permission: HR_PERMISSIONS.leaveView,
      capability: HR_CAPABILITIES.leave,
      sizes: ['s', 'm'],
      defaultSize: 'm',
      order: 20,
      component: () => import('./widgets/LeaveBalanceWidget.svelte'),
    },
    {
      id: 'hr.whos-out',
      get title() {
        return m.hr_widget_whos_out_title()
      },
      get description() {
        return m.hr_widget_whos_out_desc()
      },
      icon: 'calendar-days',
      permission: HR_PERMISSIONS.leaveViewTeam,
      capability: HR_CAPABILITIES.leave,
      sizes: ['m', 'l'],
      defaultSize: 'm',
      order: 30,
      component: () => import('./widgets/WhosOutWidget.svelte'),
    },
    {
      id: 'hr.approvals',
      get title() {
        return m.hr_widget_approvals_title()
      },
      get description() {
        return m.hr_widget_approvals_desc()
      },
      icon: 'check-check',
      sizes: ['s', 'm', 'l'],
      defaultSize: 'm',
      order: 40,
      component: () => import('./widgets/ApprovalsWidget.svelte'),
    },
    {
      id: 'hr.headcount',
      get title() {
        return m.hr_widget_headcount_title()
      },
      get description() {
        return m.hr_widget_headcount_desc()
      },
      icon: 'users',
      permission: HR_PERMISSIONS.personView,
      sizes: ['s'],
      defaultSize: 's',
      compact: true,
      order: 50,
      component: () => import('./widgets/HeadcountWidget.svelte'),
    },
  ],

  commands: [
    {
      id: 'hr.directory',
      get label() {
        return m.hr_cmd_directory()
      },
      icon: 'users',
      permission: HR_PERMISSIONS.personView,
      run: (ctx) => ctx.navigate('/hr'),
    },
    {
      id: 'hr.request-leave',
      get label() {
        return m.hr_cmd_request_leave()
      },
      icon: 'tree-palm',
      permission: HR_PERMISSIONS.leaveRequest,
      capability: HR_CAPABILITIES.leave,
      run: (ctx) => ctx.navigate('/hr/leave?new=1'),
    },
    {
      id: 'hr.my-attendance',
      get label() {
        return m.hr_cmd_attendance()
      },
      icon: 'timer',
      permission: HR_PERMISSIONS.attendanceView,
      capability: HR_CAPABILITIES.attendance,
      run: (ctx) => ctx.navigate('/hr/attendance'),
    },
    {
      id: 'hr.approvals',
      get label() {
        return m.hr_cmd_approvals()
      },
      icon: 'check-check',
      run: (ctx) => ctx.navigate('/hr/approvals'),
    },
  ],

  sidebar: [
    {
      id: 'hr',
      match: ['hr'],
      permission: HR_PERMISSIONS.personView,
      component: () => import('./components/HrSidebar.svelte'),
    },
  ],

  /**
   * Where HR is configured. The shell builds the settings nav from these, and the route is
   * conventional (`/<ws>/settings/hr/<id>`) — so the file has to be
   * `settings/hr/<id>/+page.svelte` or the entry renders and 404s, which nothing checks.
   */
  settingsPages: [
    {
      id: 'capabilities',
      get label() {
        return m.hr_settings_capabilities()
      },
      icon: 'toggle-left',
      scope: 'workspace',
      permission: 'core.workspace.manage',
      order: 5,
      component: () => import('../../../routes/(app)/[ws]/settings/hr/capabilities/+page.svelte'),
    },
    {
      id: 'offices',
      get label() {
        return m.hr_settings_offices()
      },
      icon: 'building',
      scope: 'workspace',
      permission: HR_PERMISSIONS.officeManage,
      capability: HR_CAPABILITIES.offices,
      order: 10,
      component: () => import('../../../routes/(app)/[ws]/settings/hr/offices/+page.svelte'),
    },
    {
      id: 'calendars',
      get label() {
        return m.hr_settings_calendars()
      },
      icon: 'calendar',
      scope: 'workspace',
      permission: HR_PERMISSIONS.calendarManage,
      capability: HR_CAPABILITIES.calendars,
      order: 20,
      component: () => import('../../../routes/(app)/[ws]/settings/hr/calendars/+page.svelte'),
    },
    {
      id: 'leave',
      get label() {
        return m.hr_settings_leave()
      },
      icon: 'tree-palm',
      scope: 'workspace',
      permission: HR_PERMISSIONS.leaveManage,
      capability: HR_CAPABILITIES.leave,
      order: 30,
      component: () => import('../../../routes/(app)/[ws]/settings/hr/leave/+page.svelte'),
    },
    {
      id: 'schedules',
      get label() {
        return m.hr_settings_schedules()
      },
      icon: 'clock',
      scope: 'workspace',
      permission: HR_PERMISSIONS.attendanceManage,
      capability: HR_CAPABILITIES.attendance,
      order: 40,
      component: () => import('../../../routes/(app)/[ws]/settings/hr/schedules/+page.svelte'),
    },
  ],

  presenters: [
    {
      type: 'person',
      inline: () => import('./components/PersonInline.svelte'),
      page: (id, workspaceSlug) => `/${workspaceSlug}/hr?person=${encodeURIComponent(id)}`,
    },
  ],
})

export default hrClientModule
