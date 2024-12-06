import { useCurrentDashboard } from "@/app/[username]/[dashboard_slug]/_components/current-dashboard-provider";
import { useDnd } from "@/app/[username]/[dashboard_slug]/_components/dnd-provider";
import { EditButton } from "@/app/[username]/[dashboard_slug]/_components/edit-button";
import { useEditMode } from "@/app/[username]/[dashboard_slug]/_components/edit-mode-provider";
import { AddCardButton } from "@/components/cards/_utils/add-card";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/server/trpc/setup/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const RenameDashboardFormSchema = z.object({
  title: z
    .string()
    .min(2, {
      message: "Should be at least 2 characters.",
    })
    .max(32, {
      message: "Should be at most 32 characters.",
    }),
});

type Props = {
  isOwner: boolean;
  hasCards: boolean;
  username: string;
  dashboardSlug: string;
};

export function DashboardTitleBar({
  username,
  dashboardSlug,
  isOwner,
  hasCards,
}: Props) {
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const { isPendingReorderCards } = useDnd();
  const {
    dashboardName,
    isPendingDashboard,
    isLoadingErrorDashboard,
    invalidateDashboard,
    cancelDashboardsQuery,
  } = useCurrentDashboard();
  const { isEnabled: isEnabledEdit } = useEditMode();

  const {
    mutate: renameDashboard,
    isPending: isPendingRenameDashboard,
    error: errorRenameDashboard,
  } = api.ui.renameDashboard.useMutation({
    onMutate: () => {
      cancelDashboardsQuery();
    },
    onSuccess: async () => {
      await invalidateDashboard();
      setIsRenameDialogOpen(false);
    },
  });

  const form = useForm<z.infer<typeof RenameDashboardFormSchema>>({
    resolver: zodResolver(RenameDashboardFormSchema),
    defaultValues: {
      title: "",
    },
  });

  async function onRenameDashboardFormSubmit(
    values: z.infer<typeof RenameDashboardFormSchema>
  ) {
    renameDashboard({
      title: values.title,
      dashboardSlug: dashboardSlug,
    });
  }

  return (
    <div className="col-span-12 items-center justify-between flex gap-2 px-1 pb-1 md:pb-2">
      {!isEnabledEdit ? (
        <h1 className="border border-transparent px-2 py-1.5 md:py-0.5 rounded-lg font-bold text-xl md:text-2xl leading-none truncate shrink">
          {isPendingDashboard
            ? "Loading"
            : isLoadingErrorDashboard
            ? "Error"
            : dashboardName}
        </h1>
      ) : (
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogTrigger
            className="focus:outline-none focus-visible:outline-none focus-visible:ring-foreground/50 focus-visible:ring-offset-2 
            focus-visible:ring-offset-background focus-visible:ring-1 rounded-lg"
          >
            <h1
              className="border not-touch:hover:bg-border active:bg-border px-2 py-1.5 md:py-0.5 rounded-lg 
              font-bold text-xl md:text-2xl leading-none truncate shrink"
            >
              {isPendingDashboard
                ? "Loading"
                : isLoadingErrorDashboard
                ? "Error"
                : dashboardName}
            </h1>
          </DialogTrigger>
          <DialogContent
            classNameInnerWrapper="gap-4"
            className="w-full max-w-[22rem]"
          >
            <DialogHeader>
              <DialogTitle>Rename Dashboard</DialogTitle>
              <DialogDescription>
                Give a new name to your dashboard.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onRenameDashboardFormSubmit)}
                className="w-full flex flex-col gap-3"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="w-full flex flex-col gap-2">
                      <FormLabel className="w-full sr-only">
                        Dashboard Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full"
                          autoCapitalize="none"
                          autoComplete="off"
                          autoCorrect="off"
                          placeholder={dashboardName || "New Name"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  state={isPendingRenameDashboard ? "loading" : "default"}
                  type="submit"
                >
                  {isPendingRenameDashboard && (
                    <>
                      <p className="text-transparent select-none shrink min-w-0 truncate">
                        Rename
                      </p>
                      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <LoaderIcon className="size-full animate-spin" />
                      </div>
                    </>
                  )}
                  {!isPendingRenameDashboard && "Rename"}
                </Button>
              </form>
            </Form>
            {errorRenameDashboard && (
              <ErrorLine message={errorRenameDashboard.message} />
            )}
          </DialogContent>
        </Dialog>
      )}
      {isOwner && hasCards ? (
        <div className="flex items-center justify-start shrink-0 gap-1.5">
          {isPendingReorderCards && (
            <div className="size-9 flex items-center justify-center">
              <LoaderIcon className="size-5 text-muted-more-foreground animate-spin" />
            </div>
          )}
          <AddCardButton
            variant="icon"
            username={username}
            dashboardSlug={dashboardSlug}
            xOrderPreference="first"
          />
          <EditButton />
        </div>
      ) : (
        <div className="size-9 -mr-2 shrink-0" />
      )}
    </div>
  );
}
