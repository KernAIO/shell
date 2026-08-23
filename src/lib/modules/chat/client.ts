import { defineClientModule } from '@kernhq/ui'
import * as m from '$msg'
import { CHAT_PERMISSIONS } from './permissions'

/**
 * Chat as the shell sees it.
 *
 * Like every module, it declares what it contributes rather than reaching into the application:
 * navigation, its page, command-palette actions and how a conversation is drawn when another module
 * links to one. Turning chat off in workspace settings removes all of it with no conditionals
 * anywhere in the shell.
 *
 * Labels are getters because a module is defined once at import time while the interface language
 * can change afterwards; reading them on render keeps the rail in the language actually chosen.
 */
export const chatClientModule = defineClientModule({
  id: 'chat',
  name: 'Chat',
  icon: 'message-circle',

  widgets: [
    {
      id: 'chat.unread',
      get title() {
        return m.widget_chat_title()
      },
      get description() {
        return m.widget_chat_desc()
      },
      icon: 'message-square-text',
      permission: CHAT_PERMISSIONS.view,
      sizes: ['m', 'l', 'xl'],
      defaultSize: 'm',
      order: 10,
      settings: [
        {
          kind: 'toggle',
          key: 'mentionsOnly',
          get label() {
            return m.widget_chat_mentions_only()
          },
          default: false,
        },
        {
          kind: 'number',
          key: 'limit',
          get label() {
            return m.widget_setting_rows()
          },
          default: 6,
          min: 3,
          max: 15,
        },
      ],
      component: () => import('./widgets/UnreadChatWidget.svelte'),
    },
    {
      id: 'chat.stat-unread',
      get title() {
        return m.widget_chat_unread_title()
      },
      get description() {
        return m.widget_chat_unread_desc()
      },
      icon: 'message-circle',
      permission: CHAT_PERMISSIONS.view,
      sizes: ['s'],
      defaultSize: 's',
      compact: true,
      order: 20,
      component: () => import('./widgets/UnreadCountWidget.svelte'),
    },
  ],

  nav: [
    {
      id: 'chat',
      get label() {
        return m.chat_nav()
      },
      icon: 'message-circle',
      href: '/chat',
      order: 30,
      permission: CHAT_PERMISSIONS.view,
    },
  ],

  routes: [
    {
      path: '/chat',
      component: () => import('./ChatPage.svelte'),
      get title() {
        return m.chat_title()
      },
      permission: CHAT_PERMISSIONS.view,
    },
  ],

  commands: [
    {
      id: 'chat.open',
      get label() {
        return m.chat_cmd_open()
      },
      icon: 'message-circle',
      permission: CHAT_PERMISSIONS.view,
      run: (ctx) => ctx.navigate('/chat'),
    },
    {
      id: 'chat.new-channel',
      get label() {
        return m.chat_cmd_new_channel()
      },
      icon: 'plus',
      permission: CHAT_PERMISSIONS.createChannel,
      run: (ctx) => ctx.navigate('/chat?new=1'),
    },
    {
      id: 'chat.browse',
      get label() {
        return m.chat_cmd_browse()
      },
      icon: 'hash',
      permission: CHAT_PERMISSIONS.view,
      run: (ctx) => ctx.navigate('/chat?browse=1'),
    },
  ],

  sidebar: [
    {
      id: 'chat',
      match: ['chat'],
      permission: CHAT_PERMISSIONS.view,
      component: () => import('./components/SidebarConversations.svelte'),
    },
  ],

  presenters: [
    {
      type: 'channel',
      inline: () => import('./components/ChannelInline.svelte'),
      page: (id, workspaceSlug) => `/${workspaceSlug}/chat?c=${encodeURIComponent(id)}`,
    },
  ],
})

export default chatClientModule
