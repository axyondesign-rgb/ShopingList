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
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Modal states for List
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);
  const [listForm, setListForm] = useState({ name: '', date: '', time: '' });
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [swipedListId, setSwipedListId] = useState<string | null>(null);

  // Click outside to reset swipe
  useEffect(() => {
    const handleGlobalClick = () => setSwipedListId(null);
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

  // Notifications
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const interval = setInterval(() => {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().substring(0, 5);

      setLists((prevLists) => {
        let changed = false;
        const updated = prevLists.map((list) => {
          if (list.date === currentDate && list.time === currentTime && !list.notified) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Напоминание о покупках!', {
                body: `Пора за покупками: ${list.name}`,
              });
            }
            changed = true;
            return { ...list, notified: true };
          }
          return list;
        });
        return changed ? updated : prevLists;
      });
    }, 15000);

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
      setActiveListId(null);
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
        <aside className={`w-full flex-1 md:flex-none md:w-[320px] h-full md:h-auto bg-[#F0EEE4] md:border-r border-[#E2E0D4] flex-col p-6 md:p-8 shrink-0 ${activeListId ? 'hidden md:flex' : 'flex'}`}>
          <div className="font-serif italic text-2xl mb-10 text-[#6B705C] font-semibold">natural list.</div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pb-6 pr-2">
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
                      setActiveListId(list.id);
                    }}
                    className={`p-4 rounded-2xl cursor-pointer border transition-all relative overflow-hidden group ${
                      isActive 
                        ? 'bg-white border-[#E2E0D4] shadow-[0_4px_12px_rgba(0,0,0,0.03)]' 
                        : 'bg-transparent border-transparent hover:border-[#E2E0D4] hover:bg-white/50'
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

          <button
            onClick={() => handleOpenListModal()}
            className="mt-auto px-4 py-3.5 bg-[#6B705C] text-white rounded-full font-semibold hover:bg-[#A5A58D] transition-colors w-full flex items-center justify-center gap-2 shadow-sm shrink-0"
          >
            <Plus className="w-5 h-5" />
            Создать список
          </button>
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
                    <button onClick={() => setActiveListId(null)} className="md:hidden text-[#8B8D85] hover:text-[#3F4238] transition-colors -ml-2 p-2">
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

              <div className="flex-1 overflow-y-auto pr-2 pb-4">
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
                          className="flex items-center py-3.5 border-b border-[#E2E0D4] group"
                        >
                          <button
                            onClick={() => toggleItemCompletion(item.id)}
                            className={`w-6 h-6 rounded-md border-2 mr-4 flex flex-shrink-0 items-center justify-center transition-colors ${
                              item.isCompleted 
                                ? 'bg-[#A5A58D] border-[#A5A58D] text-white' 
                                : 'border-[#A5A58D] text-transparent hover:bg-[#E2E0D4]/30'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          
                          <span className={`text-[18px] flex-1 transition-all ${
                            item.isCompleted ? 'text-[#8B8D85] line-through' : 'text-[#3F4238]'
                          }`}>
                            {item.name}
                          </span>

                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-2 text-[#E2E0D4] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ml-2 focus:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsListModalOpen(false)}
              className="absolute inset-0 bg-[#3F4238]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#F8F7F2] rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden border border-[#E2E0D4]"
            >
              <div className="px-6 py-5 border-b border-[#E2E0D4] flex justify-between items-center bg-[#F0EEE4]">
                <h3 className="text-xl font-serif text-[#3F4238]">
                  {editingList ? 'Редактировать список' : 'Новый список'}
                </h3>
                <button
                  onClick={() => setIsListModalOpen(false)}
                  className="text-[#8B8D85] hover:text-[#3F4238] p-1"
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
                    onChange={e => setListForm({ ...listForm, name: e.target.value })}
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
                    <span className="flex items-center gap-1">
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

              <div className="px-6 py-5 bg-[#F0EEE4] flex justify-end gap-3 rounded-b-3xl">
                <button
                  onClick={() => setIsListModalOpen(false)}
                  className="px-5 py-2.5 text-[#6B705C] font-semibold hover:bg-[#E2E0D4]/50 rounded-full transition-colors shrink-0"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveList}
                  disabled={!listForm.name.trim()}
                  className="px-6 py-2.5 bg-[#6B705C] text-white font-semibold rounded-full hover:bg-[#A5A58D] disabled:opacity-50 transition-colors shadow-sm shrink-0"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
