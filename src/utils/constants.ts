export const CustomIds = {
  TICKET_PURCHASE: 'ticket:purchase',
  TICKET_SUPPORT: 'ticket:support',
  TICKET_INQUIRY: 'ticket:inquiry',
  TICKET_CLOSE: 'ticket:close',
  PRODUCT_SELECT: 'ticket:product-select',
  PRODUCT_REMOVE: 'admin:product-remove',
  PRODUCT_DELETE_ALL_CONFIRM: 'admin:product-delete-all-confirm',
  PRODUCT_DELETE_ALL_CANCEL: 'admin:product-delete-all-cancel',
  FEEDBACK_OPEN: 'feedback:open',
  MODAL_LICENSE: 'modal:license',
  MODAL_FEEDBACK: 'modal:feedback',
} as const;

export type TicketType = 'purchase' | 'support' | 'inquiry';
