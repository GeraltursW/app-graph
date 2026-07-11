import { message, Modal, notification } from 'ant-design-vue';

export function useMessage() {
  return {
    createMessage: message,
    createErrorModal: (options: any) => Modal.error(options),
    createSuccessModal: (options: any) => Modal.success(options),
    notification,
  };
}
