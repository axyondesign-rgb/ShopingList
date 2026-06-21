import { useState, useEffect, MouseEvent, FormEvent } from 'react';
import { Plus, Trash2, Edit2, ChevronLeft, Check, Bell, Calendar, ListTodo, HelpCircle, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

function getNotificationPermission(): string {
  try {
    if ('Notification' in window) {
      return Notification.permission;
    }
  } catch (e) {
    console.warn('Access to Notification.permission is blocked:', e);
  }
  return 'denied';
}

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

export default function App() {
  const [lists, setLists] = useState<ShoppingList[]>(getInitialLists);
  const [items, setItems] = useState<ShoppingItem[]>(getInitialItems);
  
  // Initialize active list state from URL hash for deep linking
  const [activeListId, setActiveListId] = useState<string | null>(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#list-')) {
        return hash.replace('#list-', '');
      }
    } catch (e) {
      console.warn('Error reading location hash on initialization:', e);
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

  // Track last back press time for double-back exit
  const [lastBackPress, setLastBackPress] = useState<number>(0);
  const [showExitToast, setShowExitToast] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Set up the initial history trap to gracefully manage app closing on Android back gesture
  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#list-')) {
        const listId = hash.replace('#list-', '');
        window.history.replaceState({ page: 'exit-trap' }, '', '');
        window.history.pushState({ page: 'main' }, '', '');
        window.history.pushState({ listId }, '', hash);
      } else {
        window.history.replaceState({ page: 'exit-trap' }, '', '');
        window.history.pushState({ page: 'main' }, '', '');
      }
    } catch (e) {
      console.warn('History management init error:', e);
    }
  }, []);

  // Listen to browser back/forward history events for swipe back gesture
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      try {
        const state = event.state;
        const hash = window.location.hash;

        if (state && state.page === 'exit-trap') {
          const now = Date.now();
          if (now - lastBackPress < 2000) {
            // Second back press: let browser complete natural exit flow
            try {
              window.close();
            } catch (e) {}
          } else {
            // First back press: intercept exit, show toast reminder
            setLastBackPress(now);
            setShowExitToast(true);
            setTimeout(() => setShowExitToast(false), 2000);

            // Re-push main state to hold them safely inside the app
            window.history.pushState({ page: 'main' }, '', '');
          }
        } else if (hash && hash.startsWith('#list-')) {
          setActiveListId(hash.replace('#list-', ''));
        } else {
          setActiveListId(null);
        }
      } catch (e) {
        console.warn('Error handling popstate event:', e);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [lastBackPress]);

  // Wrapper to select/deselect lists and push history states
  const handleSelectList = (id: string | null) => {
    if (id) {
      try {
        window.history.pushState({ listId: id }, '', `#list-${id}`);
      } catch (e) {
        console.warn('history.pushState failed/blocked:', e);
      }
      setActiveListId(id);
    } else {
      try {
        if (window.location.hash) {
          window.history.back();
        } else {
          setActiveListId(null);
        }
      } catch (e) {
        console.warn('history.back failed/blocked:', e);
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
      try {
        if ('Notification' in window && getNotificationPermission() === 'default') {
          const permission = await Notification.requestPermission();
          console.log('Notification permission:', permission);
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
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
            
            try {
              if ('Notification' in window && getNotificationPermission() === 'granted') {
                // Обычное уведомление
                const notification = new Notification('Напоминание о покупках! 🛒', {
                  body: `Пора за покупками: ${list.name}`,
                  icon: '/icon.png',
                  badge: '/icon.png',
                  vibrate: [200, 100, 200],
                  tag: `shopping-${list.id}`,
                  requireInteraction: false,
                } as any);

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
            } catch (error) {
              console.error('Error triggered while sending notification:', error);
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



  const activeList = lists.find(l => l.id === activeListId);
  const activeItems = items.filter(i => i.listId === activeListId);

  // Sort: pending first, then completed
  const sortedItems = [...activeItems].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted));

  return (
    <div className="min-h-screen bg-[#F8F7F2] text-[#3F4238] font-sans flex items-center justify-center p-0 md:p-4 selection:bg-[#E2E0D4] selection:text-[#3F4238]">
      <div className="w-full md:max-w-[1024px] h-[100dvh] md:h-[768px] md:max-h-[90vh] bg-[#F8F7F2] md:shadow-2xl md:border border-[#E2E0D4] md:rounded-2xl overflow-hidden flex flex-col md:flex-row relative">
        
        {/* Sidebar - Groups */}
        <aside className={`w-full flex-1 md:flex-none md:w-[320px] h-full md:h-auto bg-[#F0EEE4] md:border-r border-[#E2E0D4] flex-col p-6 md:p-8 shrink-0 relative ${activeListId ? 'hidden md:flex' : 'flex'}`}>
          <div className="font-serif italic text-2xl mb-10 text-[#6B705C] font-semibold text-center w-full select-none">natural list.</div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pb-[92px] pr-2 custom-scrollbar">
            {lists.length === 0 ? (
              <div className="text-[#8B8D85] text-sm text-center mt-10">
                Нет списков покупок
              </div>
            ) : (
              lists.map(list => {
                const listItems = items.filter(i => i.listId === list.id);
                const totalCount = listItems.length;
                const completedCount = listItems.filter(i => i.isCompleted).length;
                const isActive = activeListId === list.id;

                const isSwiped = swipedListId === list.id;

                return (
                  <motion.div
                    layoutId={`list-card-${list.id}`}
                    key={list.id}
                    onPanEnd={(e, info) => {
                      // Swipe left (negative x) reveals delete
                      if (info.offset.x < -30) {
                        setSwipedListId(list.id);
                      } 
                      // Swipe right dismisses it
                      else if (info.offset.x > 30 && isSwiped) {
                        setSwipedListId(null);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (swipedListId) {
                        setSwipedListId(null);
                        return;
                      }
                      handleSelectList(list.id);
                    }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all relative overflow-hidden group touch-pan-y select-none ${
                      isActive 
                        ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]' 
                        : 'bg-transparent hover:bg-white/50'
                    }`}
                  >
                    <div className="font-semibold text-[16px] text-[#3F4238] flex items-center justify-between relative z-10">
                      <span className="truncate mr-4">{list.name}</span>
                      <div className={`transition-all duration-300 ${isSwiped ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if(swipedListId) { setSwipedListId(null); return; }
                            handleOpenListModal(list); 
                          }}
                          className="p-1.5 -mr-1 text-[#8B8D85] hover:text-[#6B705C] rounded-lg transition-colors bg-white/80 md:bg-transparent shadow-sm md:shadow-none shrink-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-[12px] text-[#8B8D85] mt-1 flex justify-between items-center pr-1 relative z-10">
                      <span>{list.date ? list.date : `${completedCount}/${totalCount} куплено`}</span>
                      <span className={`flex items-center gap-1.5 transition-all duration-300 ${isSwiped ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                        {list.time && <span>{list.time}</span>}
                        {list.time || list.date ? <Bell className="w-3 h-3" /> : null}
                      </span>
                    </div>

                    <AnimatePresence>
                      {isSwiped && (
                        <motion.button
                          type="button"
                          initial={{ x: '100%' }}
                          animate={{ x: 0 }}
                          exit={{ x: '100%' }}
                          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                          className="absolute top-0 right-0 bottom-0 w-[80px] bg-[#E5A4A4] flex items-center justify-center z-20 cursor-pointer hover:bg-[#D99595] transition-colors"
                          onClickCapture={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Immediately remove from swipe config without triggering parent
                            setSwipedListId(null);
                            handleDeleteList(list.id, e as any);
                          }}
                          onPointerDownCapture={(e) => e.stopPropagation()}
                          onPointerUpCapture={(e) => e.stopPropagation()}
                          onTouchStartCapture={(e) => e.stopPropagation()}
                          onTouchEndCapture={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-5 h-5 text-white pointer-events-none" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 bg-[#F0EEE4] border-t border-[#E2E0D4] z-30">
            <button
              onClick={() => handleOpenListModal()}
              className="px-4 py-3.5 bg-[#6B705C] text-white rounded-full font-semibold hover:bg-[#A5A58D] transition-colors w-full flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer text-[15px]"
            >
              <Plus className="w-5 h-5" />
              Создать список
            </button>
          </div>
          

        </aside>

        {/* Main Content */}
        <main className={`flex-1 bg-[#F8F7F2] flex-col overflow-hidden ${!activeListId ? 'hidden md:flex' : 'flex'}`}>
          {!activeListId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#8B8D85] p-8 text-center">
              <ListTodo className="w-16 h-16 mb-4 text-[#E2E0D4]" />
              <p className="text-lg font-serif">Выберите список или создайте новый</p>
            </div>
          ) : (
            <div className="flex flex-col h-full p-6 md:p-12 lg:px-16 lg:py-12">
              <header className="mb-10">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleSelectList(null)} className="md:hidden text-[#8B8D85] hover:text-[#3F4238] transition-colors -ml-2 p-2">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="font-sans text-[25px] font-normal leading-tight text-[#3F4238] m-0">
                      {activeList?.name}
                    </h1>
                  </div>

                  {(activeList?.date || activeList?.time) && (
                    <div className="text-[12px] bg-[#FFE8D6] text-[#B07D62] px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 font-semibold shrink-0">
                      <Bell className="w-3.5 h-3.5" />
                      Напомнить: {activeList?.date} {activeList?.time}
                    </div>
                  )}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto pr-2 pb-4 custom-scrollbar">
                <AnimatePresence>
                  {sortedItems.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center text-[#8B8D85]">
                      У вас пока нет покупок в этом списке.
                    </motion.div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {sortedItems.map(item => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onPanEnd={(e, info) => {
                            if (info.offset.x < -30) {
                              setSwipedItemId(item.id);
                            } else if (info.offset.x > 30) {
                              setSwipedItemId(null);
                            }
                          }}
                          className="relative flex items-center py-3 border-b border-[#E2E0D4] touch-pan-y group overflow-hidden select-none"
                        >
                          {/* Left contents (Checkmark & Text) remains stationary */}
                          <div className="flex items-center flex-1 pr-11 transition-all">
                            <button
                              onClick={() => toggleItemCompletion(item.id)}
                              className={`w-6 h-6 rounded-md border-2 mr-4 flex flex-shrink-0 items-center justify-center transition-colors cursor-pointer ${
                                item.isCompleted 
                                  ? 'bg-[#A5A58D] border-[#A5A58D] text-white' 
                                  : 'border-[#A5A58D] text-transparent hover:bg-[#E2E0D4]/30'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            
                            <span className={`text-[17px] break-all transition-all select-none ${
                              item.isCompleted ? 'text-[#8B8D85] line-through' : 'text-[#3F4238]'
                            }`}>
                              {item.name}
                            </span>
                          </div>

                          {/* Delete action overlay */}
                          <div className="absolute right-0 top-0 bottom-0 flex items-center justify-end z-20">
                            <AnimatePresence>
                              {swipedItemId === item.id ? (
                                <motion.button
                                  type="button"
                                  initial={{ opacity: 0, scale: 0.8, x: 15 }}
                                  animate={{ opacity: 1, scale: 1, x: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, x: 15 }}
                                  transition={{ type: 'spring', bounce: 0.15, duration: 0.25 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteItem(item.id);
                                    setSwipedItemId(null);
                                  }}
                                  className="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center cursor-pointer shadow-sm mr-1"
                                  title="Удалить товар"
                                >
                                  <Trash2 className="w-4 h-4 pointer-events-none" />
                                </motion.button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteItem(item.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-2 text-[#E2E0D4] hover:text-red-500 transition-opacity cursor-pointer hidden md:flex items-center justify-center mr-1"
                                >
                                  <Trash2 className="w-4 h-4 pointer-events-none" />
                                </button>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              <form onSubmit={handleAddItem} className="mt-6 flex gap-3 shrink-0 relative">
                <input
                  type="text"
                  placeholder="Добавить новый товар..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  maxLength={100}
                  className="flex-1 px-6 py-4 pr-16 rounded-full border border-[#E2E0D4] bg-white text-[16px] text-[#3F4238] placeholder:text-[#8B8D85] outline-none focus:border-[#A5A58D] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                />
                <button
                  type="submit"
                  disabled={!newItemName.trim()}
                  className="absolute right-2 top-2 bottom-2 aspect-square w-10 h-10 bg-[#6B705C] text-white rounded-full font-semibold hover:bg-[#A5A58D] disabled:opacity-50 transition-colors flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {isListModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-4 sm:items-center sm:pt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsInputFocused(false);
                setIsListModalOpen(false);
              }}
              className="absolute inset-0 bg-[#3F4238]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.05 }}
              className="bg-[#F8F7F2] rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden border border-[#E2E0D4] origin-top"
            >
              <div className="px-6 py-5 border-b border-[#E2E0D4] flex justify-between items-center bg-[#F0EEE4]">
                <h3 className="text-xl font-serif text-[#3F4238]">
                  {editingList ? 'Редактировать список' : 'Новый список'}
                </h3>
                <button
                  onClick={() => {
                    setIsInputFocused(false);
                    setIsListModalOpen(false);
                  }}
                  className="text-[#8B8D85] hover:text-[#3F4238] p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 bg-[#F8F7F2]">
                <div>
                  <label className="block text-sm font-medium text-[#6B705C] mb-1.5">
                    Название <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={listForm.name}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onChange={e => setListForm({ ...listForm, name: e.target.value })}
                    maxLength={100}
                    className="w-full bg-white border border-[#E2E0D4] rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#E2E0D4] focus:border-[#A5A58D] transition-all text-[#3F4238]"
                    placeholder="Например: Продукты на неделю"
                    autoFocus
                  />
                </div>
                
                <div className="flex justify-center -mb-2 pt-2">
                  <label 
                    className="flex items-center gap-2 cursor-pointer text-[13px] font-medium text-[#A5A58D] hover:text-[#6B705C] transition-colors"
                  >
                    <div 
                       className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                         isSettingsExpanded 
                           ? 'bg-[#A5A58D] border-[#A5A58D] text-white' 
                           : 'border-[#A5A58D] bg-white'
                       }`}
                     >
                       {isSettingsExpanded && <Check className="w-3 h-3" />}
                    </div>
                    <input 
                       type="checkbox" 
                       className="sr-only" 
                       checked={isSettingsExpanded}
                       onChange={(e) => setIsSettingsExpanded(e.target.checked)}
                    />
                    <span className="flex items-center gap-1 select-none">
                      Напоминания (Опц.)
                      <motion.div animate={{ rotate: isSettingsExpanded ? 180 : 0 }}>
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </span>
                  </label>
                </div>

                <AnimatePresence>
                  {isSettingsExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-4 pt-4 pb-2">
                        <div className="relative">
                          <label className="block text-[13px] font-medium text-[#6B705C] mb-1.5 ml-1">Дата</label>
                          <input
                            type="date"
                            value={listForm.date}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            onClick={(e) => 'showPicker' in HTMLInputElement.prototype && e.currentTarget.showPicker()}
                            onChange={e => setListForm({ ...listForm, date: e.target.value })}
                            className="w-full bg-white border border-[#E2E0D4] rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#E2E0D4] focus:border-[#A5A58D] transition-all text-sm text-[#3F4238] [color-scheme:light] cursor-pointer"
                          />
                        </div>
                        <div className="relative">
                          <label className="block text-[13px] font-medium text-[#6B705C] mb-1.5 ml-1">Время</label>
                          <input
                            type="time"
                            value={listForm.time}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            onClick={(e) => 'showPicker' in HTMLInputElement.prototype && e.currentTarget.showPicker()}
                            onChange={e => setListForm({ ...listForm, time: e.target.value })}
                            className="w-full bg-white border border-[#E2E0D4] rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#E2E0D4] focus:border-[#A5A58D] transition-all text-sm text-[#3F4238] [color-scheme:light] cursor-pointer"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="px-5 py-4 bg-[#F0EEE4] flex justify-between items-center rounded-b-3xl gap-2 overflow-hidden border-t border-[#E2E0D4]/4 overflow-hidden">
                <div>
                  {editingList ? (
                    <button
                      onClick={(e) => {
                        if (window.confirm('Вы уверены, что хотите удалить этот список?')) {
                          handleDeleteList(editingList.id, e as any);
                          setIsListModalOpen(false);
                        }
                      }}
                      className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      title="Удалить список"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  ) : (
                    <div className="w-9 h-9"></div>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => {
                      setIsInputFocused(false);
                      setIsListModalOpen(false);
                    }}
                    className="px-4 py-2 text-[#6B705C] font-semibold hover:bg-[#E2E0D4]/50 rounded-full transition-colors shrink-0 cursor-pointer text-[14px]"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      setIsInputFocused(false);
                      handleSaveList();
                    }}
                    disabled={!listForm.name.trim()}
                    className="px-5 py-2.5 bg-[#6B705C] text-white font-semibold rounded-full hover:bg-[#A5A58D] disabled:opacity-50 transition-colors shadow-sm shrink-0 cursor-pointer text-[14px]"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Double back exit toast reminder */}
      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-[#3F4238] text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-none"
          >
            Нажмите назад ещё раз для выхода
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
