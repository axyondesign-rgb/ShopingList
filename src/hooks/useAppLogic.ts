import { useState, useEffect, MouseEvent, FormEvent } from 'react';

// --- Types ---
export interface ShoppingList {
  id: string;
  name: string;
  date?: string;
  time?: string;
  notified?: boolean;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  isCompleted: boolean;
}

// --- Helpers ---
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const STORAGE_KEY_LISTS = 'quickcart_lists';
const STORAGE_KEY_ITEMS = 'quickcart_items';

function getInitialLists(): ShoppingList[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_LISTS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function getInitialItems(): ShoppingItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_ITEMS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function useAppLogic() {
  const [lists, setLists] = useState<ShoppingList[]>(getInitialLists);
  const [items, setItems] = useState<ShoppingItem[]>(getInitialItems);

  // Initialize active list state from URL hash for deep linking
  const [activeListId, setActiveListId] = useState<string | null>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#list-')) {
      return hash.replace('#list-', '');
    }
    return null;
  });

  // Modal states for List
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);
  const [listForm, setListForm] = useState({ name: '', date: '', time: '' });
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [swipedListId, setSwipedListId] = useState<string | null>(null);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);

  // Listen to browser back/forward history events for swipe back gesture
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#list-')) {
        setActiveListId(hash.replace('#list-', ''));
      } else {
        setActiveListId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Wrapper to select/deselect lists and push history states
  const handleSelectList = (id: string | null) => {
    if (id) {
      window.history.pushState({ listId: id }, '', `#list-${id}`);
      setActiveListId(id);
    } else {
      if (window.location.hash) {
        window.history.back();
      } else {
        setActiveListId(null);
      }
    }
  };

  // Click outside to reset swipe
  useEffect(() => {
    const handleGlobalClick = () => {
      setSwipedListId(null);
      setSwipedItemId(null);
    };
    document.addEventListener('click', handleGlobalClick);

    // Try to lock screen orientation to portrait on mobile devices
    try {
      const screenAny = window.screen as any;
      if (screenAny && screenAny.orientation && screenAny.orientation.lock) {
        screenAny.orientation.lock('portrait').catch(() => {
          // Ignore the error if the browser does not allow it
        });
      }
    } catch (e) {
      // Browser does not support orientation locking
    }

    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
  }, [items]);

  // Notifications - улучшенная версия
  useEffect(() => {
    // Запрос разрешения на уведомления при первом запуске
    const requestNotificationPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          const permission = await Notification.requestPermission();
          console.log('Notification permission:', permission);
        } catch (error) {
          console.error('Error requesting notification permission:', error);
        }
      }
    };

    requestNotificationPermission();

    // Проверка каждые 30 секунд (вместо 15) для экономии батареи
    const interval = setInterval(() => {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().substring(0, 5);

      console.log('Checking reminders:', currentDate, currentTime);

      setLists((prevLists) => {
        let changed = false;
        const updated = prevLists.map((list) => {
          if (list.date === currentDate && list.time === currentTime && !list.notified) {
            console.log('Sending notification for:', list.name);

            if ('Notification' in window && Notification.permission === 'granted') {
              // Обычное уведомление
              const notification = new Notification('Напоминание о покупках! 🛒', {
                body: `Пора за покупками: ${list.name}`,
                icon: '/icon.png',
                badge: '/icon.png',
                vibrate: [200, 100, 200],
                tag: `shopping-${list.id}`,
                requireInteraction: false,
              } as NotificationOptions & { vibrate?: number[] });

              // Закрыть через 10 секунд
              setTimeout(() => notification.close(), 10000);

              // Также отправляем через Service Worker
              if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'SHOW_NOTIFICATION',
                  list: list
                });
              }
            } else {
              console.warn('Notifications not available or not permitted');
            }

            changed = true;
            return { ...list, notified: true };
          }
          return list;
        });
        return changed ? updated : prevLists;
      });
    }, 30000); // Проверка каждые 30 секунд

    return () => clearInterval(interval);
  }, []);

  // List Functions
  const handleOpenListModal = (list?: ShoppingList) => {
    if (list) {
      setEditingList(list);
      setListForm({ name: list.name, date: list.date || '', time: list.time || '' });
      setIsSettingsExpanded(!!(list.date || list.time));
    } else {
      setEditingList(null);
      setListForm({ name: '', date: '', time: '' });
      setIsSettingsExpanded(false);
    }
    setIsListModalOpen(true);
  };

  const handleSaveList = () => {
    if (!listForm.name.trim()) return;

    const finalDate = isSettingsExpanded ? listForm.date : '';
    const finalTime = isSettingsExpanded ? listForm.time : '';

    if (editingList) {
      setLists(lists.map(l => l.id === editingList.id ? {
        ...l,
        name: listForm.name,
        date: finalDate,
        time: finalTime,
        notified: false // reset notification on edit
      } : l));
    } else {
      const newList: ShoppingList = {
        id: generateId(),
        name: listForm.name,
        date: finalDate,
        time: finalTime,
        notified: false,
      };
      setLists([...lists, newList]);
    }
    setIsListModalOpen(false);
  };

  const handleDeleteList = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setLists(lists.filter(l => l.id !== id));
    setItems(items.filter(i => i.listId !== id));
    if (activeListId === id) {
      handleSelectList(null);
    }
  };

  // Item Functions
  const [newItemName, setNewItemName] = useState('');

  const handleAddItem = (e: FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !activeListId) return;

    const names = newItemName.split(/[,.]/).map(n => n.trim()).filter(n => n.length > 0);

    if (names.length === 0) return;

    const newItems: ShoppingItem[] = names.map(name => ({
      id: generateId(),
      listId: activeListId,
      name: name,
      isCompleted: false,
    }));

    setItems([...newItems, ...items]);
    setNewItemName('');
  };

  const toggleItemCompletion = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, isCompleted: !i.isCompleted } : i));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  return {
    lists,
    setLists,
    items,
    setItems,
    activeListId,
    setActiveListId,
    isListModalOpen,
    setIsListModalOpen,
    editingList,
    setEditingList,
    listForm,
    setListForm,
    isSettingsExpanded,
    setIsSettingsExpanded,
    swipedListId,
    setSwipedListId,
    swipedItemId,
    setSwipedItemId,
    newItemName,
    setNewItemName,
    handleSelectList,
    handleOpenListModal,
    handleSaveList,
    handleDeleteList,
    handleAddItem,
    toggleItemCompletion,
    deleteItem,
  };
}
