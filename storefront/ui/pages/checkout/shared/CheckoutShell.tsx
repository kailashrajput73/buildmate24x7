import type { ReactNode } from 'react';
import { StorefrontHeader } from '../../../shared/StorefrontHeader';
import { WebSideMenu } from '../../../shared/WebSideMenu';
import shellMock from './checkoutShell.mock.json';
import {
  Screen,
  ShellBody,
  Body,
  Main,
  StepList,
  StepItem,
  StepDot,
  StepLabel,
  StepSubtitle,
  Aside,
} from './checkout.styles';

const { _steps } = shellMock;

interface CheckoutShellProps {
  /** Flutter `CheckoutStepHeader.currentStep` (0 = Cart … 3 = Confirm). */
  currentStep: number;
  /** Right-hand column (order summary); the main column spans the page without it. */
  aside?: ReactNode;
  /** Hides the stepper (e.g. the empty cart, where there is no checkout to track). */
  hideSteps?: boolean;
  children: ReactNode;
}

/**
 * Web layout shared by checkout steps 1–4: the app-wide `StorefrontHeader`,
 * the `WebSideMenu` (≥ md), the 4-step stepper, a main column and an optional sticky aside.
 * Web counterpart of Flutter `CheckoutStepHeader`.
 */
export function CheckoutShell({ currentStep, aside, hideSteps, children }: CheckoutShellProps) {
  return (
    <Screen>
      <StorefrontHeader />

      <ShellBody>
        <WebSideMenu />

        <Body $single={!aside}>
          <Main>
            {!hideSteps && (
              <StepList>
                {_steps.map((step, index) => {
                  const state =
                    index < currentStep ? 'done' : index === currentStep ? 'current' : 'upcoming';
                  return (
                    <StepItem
                      key={step.label}
                      $state={state}
                      $lineDone={index < currentStep}
                      $last={index === _steps.length - 1}
                      aria-current={state === 'current' ? 'step' : undefined}
                    >
                      <StepDot $state={state}>
                        {state === 'done' ? <i className="pi pi-check" aria-hidden /> : index + 1}
                      </StepDot>
                      <StepLabel $state={state}>{step.label}</StepLabel>
                      <StepSubtitle>{step.subtitle}</StepSubtitle>
                    </StepItem>
                  );
                })}
              </StepList>
            )}
            {children}
          </Main>

          {aside && <Aside>{aside}</Aside>}
        </Body>
      </ShellBody>
    </Screen>
  );
}
