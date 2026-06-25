import toast from "react-hot-toast";

export function useToast() {
  return {
    success: (msg: string) => toast.success(msg),
    error: (msg: string) => toast.error(msg),
    loading: (msg: string) => toast.loading(msg),
    dismiss: (id?: string) => toast.dismiss(id),
    promise: <T>(
      promise: Promise<T>,
      msgs: { loading: string; success: string; error: string }
    ) => toast.promise(promise, msgs),
  };
}
