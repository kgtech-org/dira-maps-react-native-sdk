/**
 * Erreurs de Dira Maps, classées par ce que l'appelant doit en FAIRE.
 *
 * Un code HTTP nu ne dit pas s'il faut réessayer, se replier sur des segments
 * droits ou prévenir un exploitant. `kind` répond à cette question, et c'est
 * la seule raison d'être de ce type.
 */
export type DiraMapsErrorKind =
  /** Réseau injoignable, DNS, socket coupé. Réessayer plus tard. */
  | 'network'
  /** Délai dépassé côté client. Réessayer, éventuellement plus patient. */
  | 'timeout'
  /**
   * 503 : aucun moteur de routage n'est configuré côté serveur. Inutile de
   * réessayer en boucle — se replier sur des segments droits ET le dire.
   */
  | 'routing_unavailable'
  /**
   * 401 / 403 : clé API absente, inconnue, révoquée, ou service désactivé pour
   * elle. Réessayer ne changera rien : c'est une configuration à corriger,
   * dans l'application ou dans le portail Dira Maps.
   */
  | 'auth'
  /**
   * 429 : quota journalier de la clé atteint. Le serveur dit quand réessayer
   * (`retryAfterS`) ; d'ici là, se replier ou attendre, pas insister.
   */
  | 'quota'
  /** 4xx autres : requête refusée telle quelle. Corriger l'appel. */
  | 'request'
  /** 5xx autres, ou réponse illisible. */
  | 'server';

export class DiraMapsError extends Error {
  readonly kind: DiraMapsErrorKind;
  readonly status?: number;
  /** Pour `quota` : secondes à attendre avant de réessayer, si le serveur l'a dit. */
  readonly retryAfterS?: number;

  constructor(kind: DiraMapsErrorKind, message: string, status?: number, retryAfterS?: number) {
    super(message);
    this.name = 'DiraMapsError';
    this.kind = kind;
    if (status !== undefined) this.status = status;
    if (retryAfterS !== undefined) this.retryAfterS = retryAfterS;
  }

  /**
   * Vrai quand se replier sur des segments droits est la bonne conduite :
   * le service ne rendra pas d'itinéraire, insister n'aide pas.
   */
  get shouldFallBackToStraightLines(): boolean {
    return this.kind === 'routing_unavailable';
  }
}
