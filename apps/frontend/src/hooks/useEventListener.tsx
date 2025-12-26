'use client'

import { useEffect, useRef } from 'react';

type EventHandler<K extends keyof HTMLElementEventMap> = (event: HTMLElementEventMap[K]) => void;

function useEventListener<K extends keyof HTMLElementEventMap, T extends HTMLElement = HTMLDivElement>(
  eventName: K,
  handler: EventHandler<K>,
  element?: React.RefObject<T>
): void {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const targetElement: T | Window = element?.current || window;
    if (!(targetElement && targetElement.addEventListener)) return;

    const eventListener: EventHandler<K> = (event) => savedHandler.current(event);
    targetElement.addEventListener(eventName, eventListener as EventListener);

    return () => {
      targetElement.removeEventListener(eventName, eventListener as EventListener);
    };
  }, [eventName, element]);
}

export default useEventListener;