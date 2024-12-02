"use client";

import { useCurrentDashboard } from "@/app/[username]/[dashboard_slug]/_components/current-dashboard-provider";
import CardInnerWrapper from "@/components/cards/_utils/card-inner-wrapper";
import CardOuterWrapper from "@/components/cards/_utils/card-outer-wrapper";
import CardValuesFormParser from "@/components/cards/_utils/values-form/card-values-form-parser";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { formatNumberTBMK } from "@/lib/number-formatters";
import { cn } from "@/lib/utils";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { TCardValueForAddCards } from "@/server/trpc/api/routers/ui/types";
import { api } from "@/server/trpc/setup/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDownCircle,
  ArrowLeftIcon,
  LoaderIcon,
  PlusIcon,
} from "lucide-react";
import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { useHotkeys } from "react-hotkeys-hook";
import { z } from "zod";

type AddCardButtonProps = {
  username: string;
  dashboardSlug: string;
  className?: string;
};

type TSelectedCardType = AppRouterOutputs["ui"]["getCardTypes"][number];

export function AddCardButton({
  dashboardSlug,
  username,
  className,
}: AddCardButtonProps) {
  const [open, setOpen] = useState(false);

  const getCardTypesQuery = api.ui.getCardTypes.useQuery(
    {},
    {
      enabled: open,
    }
  );

  const [selectedCardType, setSelectedCardType] =
    useState<TSelectedCardType | null>(null);

  const inputs = selectedCardType?.inputs;

  type SchemaShape = { [K: string]: z.ZodString };
  const schemaObject: SchemaShape = {};
  const defaultValues: { [key: string]: string } = {};

  if (inputs) {
    inputs.forEach((input) => {
      schemaObject[input.id] = z.string().min(1, `${input.title} is required`);
      defaultValues[input.id] = "";
    });
  }
  const formSchema = z.object(schemaObject);

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues, // Add default values here
  });

  const { invalidateCards, isPendingCardInvalidation } = useCurrentDashboard();

  const { mutate: createCardMutation, isPending: isPendingCreateCard } =
    api.ui.createCard.useMutation({
      onSuccess: async () => {
        await invalidateCards();
        setOpen(false);
        setSelectedCardType(null);
        form.reset();
      },
    });

  const isFormPending = isPendingCardInvalidation || isPendingCreateCard;

  const onSubmit = (data: FormValues) => {
    if (!selectedCardType) return;
    const values: TCardValueForAddCards[] = Object.entries(data).map(
      ([key, value]) => ({
        cardTypeInputId: key,
        value,
        xOrder: inputs?.find((i) => i.id === key)?.xOrder ?? 0,
      })
    );
    createCardMutation({
      cardTypeId: selectedCardType.cardType.id,
      values,
      dashboardSlug,
    });
  };

  const onSubmitNew = (values: TCardValueForAddCards[]) => {
    const _values = values.map((value) => ({
      ...value,
      xOrder: 0,
    }));
    createCardMutation({
      cardTypeId: selectedCardType?.cardType.id ?? "",
      values: _values,
      dashboardSlug,
    });
  };

  const onSubmitWithNoValues = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCardType) return;
    createCardMutation({
      cardTypeId: selectedCardType.cardType.id,
      dashboardSlug,
      values: [],
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <CardOuterWrapper
            className={cn(
              "col-span-6 md:col-span-4 lg:col-span-3 h-32",
              className
            )}
          >
            <CardInnerWrapper
              className="flex-1 px-8 font-medium py-3 flex flex-row gap-1 items-center text-muted-foreground justify-center 
              not-touch:group-hover/card:bg-background-hover group-active/card:bg-background-hover"
            >
              <PlusIcon className="size-5 shrink-0 text-muted-foreground -ml-1" />
              <p className="min-w-0 overflow-hidden overflow-ellipsis">
                Add card
              </p>
            </CardInnerWrapper>
          </CardOuterWrapper>
        </DialogTrigger>
        <DialogContent
          variant="styleless"
          className="max-w-md"
          onEscapeKeyDown={
            selectedCardType !== null ? (e) => e.preventDefault() : undefined
          }
        >
          <DialogHeader>
            <DialogTitle className="sr-only">Add a card</DialogTitle>
          </DialogHeader>
          <AddCardCommandPanel
            form={form}
            inputs={inputs}
            selectedCardType={selectedCardType}
            setSelectedCardType={setSelectedCardType}
            isFormPending={isFormPending}
            onSubmit={form.handleSubmit(onSubmit)}
            onSubmitNew={onSubmitNew}
            onSubmitWithNoValues={onSubmitWithNoValues}
            getCardTypesQuery={getCardTypesQuery}
            className="h-96 max-h-[calc((100vh-3rem)*0.6)]"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

type AddCardCommandPanelProps = {
  getCardTypesQuery: AppRouterQueryResult<
    AppRouterOutputs["ui"]["getCardTypes"]
  >;
  form: ReturnType<typeof useForm>;
  inputs?: AppRouterOutputs["ui"]["getCardTypes"][number]["inputs"];
  isFormPending: boolean;
  selectedCardType: TSelectedCardType | null;
  setSelectedCardType: Dispatch<SetStateAction<TSelectedCardType | null>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onSubmitNew: (values: TCardValueForAddCards[]) => void;
  onSubmitWithNoValues: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
};

export function AddCardCommandPanel({
  getCardTypesQuery,
  form,
  inputs,
  isFormPending,
  selectedCardType,
  setSelectedCardType,
  onSubmit,
  onSubmitNew,
  onSubmitWithNoValues,
  className,
}: AddCardCommandPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { data, isPending, isLoadingError } = getCardTypesQuery;

  useHotkeys(
    "esc",
    (e) => {
      if (selectedCardType !== null) {
        setSelectedCardType(null);
      }
    },
    { enableOnFormTags: true }
  );

  useEffect(() => {
    if (selectedCardType === null) {
      inputRef.current?.focus();
    } else {
      const firstInput = formRef.current?.querySelector("input");
      if (firstInput) {
        firstInput.focus();
        return;
      }
      const firstButton = formRef.current?.querySelector("button");
      if (firstButton) {
        firstButton.focus();
        return;
      }
    }
  }, [selectedCardType]);

  return (
    <>
      {selectedCardType !== null && (
        <div className="w-full bg-background border rounded-xl shadow-xl shadow-shadow/[var(--opacity-shadow)]">
          <div className="w-full flex flex-row p-1">
            <Button
              onClick={() => setSelectedCardType(null)}
              variant="outline"
              className="border-none text-muted-foreground font-semibold pl-2.5 pr-3.5 py-1.5 text-left gap-1.5"
            >
              <ArrowLeftIcon className="size-4 -my-1" />
              Back
            </Button>
          </div>
          <div className="w-full bg-border h-px" />
          <div className="w-full flex flex-col items-start px-4 pt-2.5 pb-4 gap-1 relative">
            <h1 className="w-full font-bold text-lg leading-tight mt-1">
              {selectedCardType.cardType.title}
            </h1>
            <p className="w-full text-base text-muted-foreground leading-tight">
              {selectedCardType.cardType.description}
            </p>
          </div>
          <div className="w-full bg-border h-px" />
          <div
            data-has-inputs={inputs ? true : undefined}
            className="w-full px-4 pt-3.5 pb-4 data-[has-inputs]:pt-3"
          >
            {selectedCardType.cardType.id === "crypto_price_chart" ||
            selectedCardType.cardType.id === "order_book" ? (
              <CardValuesFormParser
                onFormSubmit={onSubmitNew}
                isPendingForm={isFormPending}
                cardTypeId={selectedCardType.cardType.id}
              />
            ) : (
              <AddCardForm
                form={form}
                formRef={formRef}
                inputs={inputs}
                isPending={isFormPending}
                onSubmit={onSubmit}
                onSubmitWithNoValues={onSubmitWithNoValues}
              />
            )}
          </div>
        </div>
      )}
      {selectedCardType === null && (
        <Command
          className={cn(
            "w-full rounded-xl border shadow-xl shadow-shadow/[var(--opacity-shadow)]",
            className
          )}
        >
          <CommandInput ref={inputRef} placeholder="Search for a card..." />
          {!isLoadingError && (
            <CommandEmpty className="text-muted-foreground w-full text-center text-sm py-6">
              No cards found.
            </CommandEmpty>
          )}
          {!isPending && isLoadingError && (
            <p className="w-full py-5 px-8 text-destructive text-sm text-center">
              Couldn't load cards :(
            </p>
          )}
          {!isLoadingError && (
            <CommandList>
              {!isLoadingError && (
                <CommandGroup data-pending={isPending ? true : undefined}>
                  {(
                    data ||
                    Array.from({ length: 20 }).map((_, index) => ({
                      cardType: {
                        id: `loading-${index}`,
                        title: `Loading title ${index}`,
                        description: `Loading description ${index}`,
                        alltimeCounter: 10,
                        currentCounter: 10,
                      },
                    }))
                  ).map((cardTypeObj, i) => (
                    <CommandItem
                      className="px-3 py-3 flex flex-row w-full items-center justify-between text-left gap-4"
                      key={`${cardTypeObj.cardType.id}-${i}`}
                      state={isPending ? "pending" : undefined}
                      onSelect={(e) => {
                        if (!data) return;
                        const cardType = data.find(
                          (c) => c.cardType.id === cardTypeObj.cardType.id
                        );
                        if (!cardType) return;
                        setSelectedCardType(cardType);
                      }}
                    >
                      <div className="flex flex-col items-start min-w-0 shrink overflow-hidden gap-1">
                        <p
                          className="max-w-full text-sm font-bold group-data-[pending]/command:text-transparent group-data-[pending]/command:bg-foreground
                        group-data-[pending]/command:rounded group-data-[pending]/command:animate-skeleton leading-tight"
                        >
                          {cardTypeObj.cardType.title}
                        </p>
                        <p
                          className="max-w-full text-xs text-muted-foreground group-data-[pending]/command:text-transparent group-data-[pending]/command:bg-muted-foreground
                        group-data-[pending]/command:rounded group-data-[pending]/command:animate-skeleton leading-tight"
                        >
                          {cardTypeObj.cardType.description}
                        </p>
                      </div>
                      <div className="shrink-0 flex text-muted-foreground text-sm items-center justify-end text-right gap-1">
                        <ArrowDownCircle
                          className="size-3 -my-1 group-data-[pending]/command:text-transparent group-data-[pending]/command:rounded-full
                        group-data-[pending]/command:bg-muted-foreground group-data-[pending]/command:animate-skeleton"
                        />
                        <p
                          className="leading-none font-medium 
                        group-data-[pending]/command:text-transparent group-data-[pending]/command:bg-muted-foreground
                        group-data-[pending]/command:rounded group-data-[pending]/command:animate-skeleton"
                        >
                          {formatNumberTBMK(
                            cardTypeObj.cardType.alltimeCounter
                          )}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          )}
        </Command>
      )}
    </>
  );
}

export function AddCardForm({
  form,
  inputs,
  isPending,
  onSubmit,
  onSubmitWithNoValues,
  formRef,
}: {
  form: ReturnType<typeof useForm>;
  inputs?: AppRouterOutputs["ui"]["getCardTypes"][number]["inputs"];
  isPending: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onSubmitWithNoValues: (e: FormEvent<HTMLFormElement>) => void;
  formRef: React.RefObject<HTMLFormElement>;
}) {
  if (!inputs) {
    return (
      <form ref={formRef} onSubmit={onSubmitWithNoValues}>
        <AddCardFormSubmitButton isPending={isPending} />
      </form>
    );
  }

  return (
    <Form {...form}>
      <form ref={formRef} onSubmit={onSubmit}>
        {inputs
          .sort((a, b) => a.xOrder - b.xOrder)
          .map((input, index) => {
            return (
              <FormField
                key={input.id}
                name={input.id}
                control={form.control}
                render={({ field }) => (
                  <FormItem
                    data-first={index === 0 ? true : undefined}
                    className="mt-5 data-[first]:mt-0"
                  >
                    <FormLabel className="text-base font-bold leading-tight">
                      {input.title}
                    </FormLabel>
                    <FormDescription className="text-sm leading-tight mt-0.5">
                      {input.description}
                    </FormDescription>
                    <FormControl className="mt-3">
                      <Input
                        {...field}
                        placeholder={input.placeholder}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              ></FormField>
            );
          })}
        <AddCardFormSubmitButton isPending={isPending} className="mt-5" />
      </form>
    </Form>
  );
}

function AddCardFormSubmitButton({
  isPending,
  className,
}: {
  isPending: boolean;
  className?: string;
}) {
  return (
    <Button
      className={cn("w-full", className)}
      state={isPending ? "loading" : undefined}
    >
      {isPending && (
        <>
          <p className="text-transparent select-none">Add Card</p>
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <LoaderIcon className="size-full animate-spin" />
          </div>
        </>
      )}
      {!isPending && "Add Card"}
    </Button>
  );
}
