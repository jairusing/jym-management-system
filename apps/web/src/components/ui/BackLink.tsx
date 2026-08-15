import { ActionLink } from './ActionLink';

type BackLinkProps = {
  to: string;
  label?: string;
};

export function BackLink({ to, label = 'Back' }: BackLinkProps) {
  return <ActionLink label={`← ${label}`} href={to} />;
}
