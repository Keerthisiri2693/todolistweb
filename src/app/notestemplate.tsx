import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

type TemplateCategory = "Recent" | "List" | "Plan" | "Journal" | "Idea";

type NoteTemplate = {
  id: string;
  title: string;
  category: TemplateCategory;
  emoji: string;
  background: string;
  content: string;
};

const categories: TemplateCategory[] = [
  "Recent",
  "List",
  "Plan",
  "Journal",
  "Idea",
];

const templates: NoteTemplate[] = [
  {
    id: "grocery",
    title: "Grocery List",
    category: "List",
    emoji: "🥑",
    background: "#E7F0D8",
    content:
      "🥬 Produce\n☐ Tomatoes\n☐ Vegetables\n\n🥛 Dairy & Eggs\n☐ Milk\n☐ Eggs\n\n🥩 Meat & Seafood\n☐ Chicken\n☐ Fish\n\n🥫 Pantry\n☐ Rice\n☐ Cooking oil\n\n❄️ Frozen\n☐ Frozen vegetables\n\n🥤 Snacks & Drinks\n☐ Snacks\n☐ Juice",
  },
  {
    id: "checklist",
    title: "To-Do List",
    category: "List",
    emoji: "✅",
    background: "#DCEBFF",
    content:
      "Today's Tasks\n\n☐ Important task\n☐ Work to complete\n☐ Personal task\n☐ Review progress\n\nNotes:\n",
  },
  {
    id: "travel",
    title: "Travel Packing List",
    category: "List",
    emoji: "🧳",
    background: "#FFF0DF",
    content:
      "Travel Packing List\n\nDocuments\n☐ ID / Passport\n☐ Tickets\n\nClothing\n☐ Outfits\n☐ Comfortable shoes\n\nEssentials\n☐ Charger\n☐ Toiletries\n☐ Medicines",
  },
  {
    id: "account",
    title: "Account List",
    category: "List",
    emoji: "💳",
    background: "#FFE8BD",
    content:
      "Account List\n\n☐ Bank account\n☐ Bills to pay\n☐ Subscriptions\n\nNotes:\n",
  },
  {
    id: "gift",
    title: "Gift List",
    category: "List",
    emoji: "🎁",
    background: "#FFE4E7",
    content:
      "Gift List\n\n☐ Person:\n  Gift idea:\n  Budget:\n\n☐ Person:\n  Gift idea:\n  Budget:\n",
  },
  {
    id: "donation",
    title: "Donation List",
    category: "List",
    emoji: "💚",
    background: "#E4EFD9",
    content: "Donation List\n\n☐ Organization:\n  Amount:\n  Date:\n\nNotes:\n",
  },
  {
    id: "movie",
    title: "Movie List",
    category: "List",
    emoji: "🎬",
    background: "#DCE9FF",
    content:
      "Movies to Watch\n\n☐ Movie title\n☐ Movie title\n☐ Movie title\n\nFavorites:\n",
  },
  {
    id: "wishlist",
    title: "Wish List",
    category: "List",
    emoji: "⭐",
    background: "#FFF0BF",
    content:
      "My Wish List\n\n☐ Item:\n  Estimated cost:\n  Priority:\n\n☐ Item:\n  Estimated cost:\n  Priority:\n",
  },
  {
    id: "daily",
    title: "Daily Plan",
    category: "Plan",
    emoji: "🎯",
    background: "#D8E8FF",
    content:
      "Daily Plan\n\nTop Priorities\n☐ Priority 1\n☐ Priority 2\n☐ Priority 3\n\nSchedule\nMorning:\nAfternoon:\nEvening:\n\nNotes:\n",
  },
  {
    id: "weekly",
    title: "Weekly Plan",
    category: "Plan",
    emoji: "📅",
    background: "#FFF0C4",
    content:
      "Weekly Plan\n\nMonday:\nTuesday:\nWednesday:\nThursday:\nFriday:\nSaturday:\nSunday:\n\nWeekly goals:\n",
  },
  {
    id: "monthly",
    title: "Monthly Plan",
    category: "Plan",
    emoji: "🗓️",
    background: "#FFE9D7",
    content:
      "Monthly Plan\n\nGoals\n☐ Goal 1\n☐ Goal 2\n☐ Goal 3\n\nImportant dates:\n\nNotes:\n",
  },
  {
    id: "meal",
    title: "Weekly Meal Plan",
    category: "Plan",
    emoji: "🥗",
    background: "#E4F0DE",
    content:
      "Weekly Meal Plan\n\nMonday:\nBreakfast:\nLunch:\nDinner:\n\nTuesday:\nBreakfast:\nLunch:\nDinner:\n\nShopping notes:\n",
  },
  {
    id: "vacation",
    title: "Vacation Plan",
    category: "Plan",
    emoji: "✈️",
    background: "#DFEAFF",
    content:
      "Vacation Plan\n\nDestination:\nTravel dates:\nAccommodation:\n\nPlaces to visit\n☐ Place 1\n☐ Place 2\n\nThings to pack:\n",
  },
  {
    id: "weekend",
    title: "Weekend Plan",
    category: "Plan",
    emoji: "⏰",
    background: "#DDF3EF",
    content:
      "Weekend Plan\n\nSaturday\n☐ Morning\n☐ Afternoon\n☐ Evening\n\nSunday\n☐ Morning\n☐ Afternoon\n☐ Evening\n",
  },
  {
    id: "party",
    title: "Party Plan",
    category: "Plan",
    emoji: "🎉",
    background: "#F0E1FF",
    content:
      "Party Plan\n\nOccasion:\nDate and time:\nVenue:\nGuest list:\n\n☐ Decorations\n☐ Food and drinks\n☐ Invitations\n☐ Music\n",
  },
  {
    id: "budget",
    title: "Budget Plan",
    category: "Plan",
    emoji: "💰",
    background: "#FFF0BF",
    content:
      "Budget Plan\n\nIncome:\n\nExpenses\n☐ Housing:\n☐ Food:\n☐ Travel:\n☐ Other:\n\nSavings goal:\nRemaining budget:\n",
  },
  {
    id: "journal",
    title: "Daily Journal",
    category: "Journal",
    emoji: "📔",
    background: "#FFF0B8",
    content:
      "Daily Journal\n\nDate:\n\nToday I feel...\n\nWhat happened today?\n\nWhat I am grateful for:\n\nTomorrow I want to...\n",
  },
  {
    id: "gratitude",
    title: "Gratitude Journal",
    category: "Journal",
    emoji: "🙏",
    background: "#FFE1E9",
    content:
      "Gratitude Journal\n\nToday I am grateful for:\n1.\n2.\n3.\n\nA person I appreciate:\n\nSomething good that happened:\n",
  },
  {
    id: "reflection",
    title: "Evening Reflection",
    category: "Journal",
    emoji: "🌙",
    background: "#EEDCFF",
    content:
      "Evening Reflection\n\nWhat went well today?\n\nWhat did I learn?\n\nWhat could I improve?\n\nHow am I feeling now?\n\nTomorrow's intention:\n",
  },
  {
    id: "mood",
    title: "Mood Journal",
    category: "Journal",
    emoji: "😊",
    background: "#FFE2ED",
    content:
      "Mood Journal\n\nMood today:\nEnergy level:\n\nWhat affected my mood?\n\nWhat helped me feel better?\n\nNotes:\n",
  },
  {
    id: "selfcare",
    title: "Self-Care Journal",
    category: "Journal",
    emoji: "🌿",
    background: "#FFE6E5",
    content:
      "Self-Care Journal\n\nHow I feel:\n\n☐ Drink water\n☐ Take a break\n☐ Exercise\n☐ Rest\n☐ Do something I enjoy\n\nReflection:\n",
  },
  {
    id: "memory",
    title: "Memory Journal",
    category: "Journal",
    emoji: "💛",
    background: "#FFE9D0",
    content:
      "Memory Journal\n\nDate and place:\n\nWhat happened?\n\nWho was there?\n\nMy favorite moment:\n\nWhy I want to remember it:\n",
  },
  {
    id: "growth",
    title: "Personal Growth Journal",
    category: "Journal",
    emoji: "🌱",
    background: "#DFEFFF",
    content:
      "Personal Growth Journal\n\nMy current goal:\n\nSmall steps I can take:\n☐ Step 1\n☐ Step 2\n☐ Step 3\n\nWhat I learned:\n",
  },
  {
    id: "ideas",
    title: "Quick Ideas",
    category: "Idea",
    emoji: "💡",
    background: "#FFF0CB",
    content:
      "Quick Ideas\n\nIdea:\n\nWhy it matters:\n\nNext steps:\n☐ Step 1\n☐ Step 2\n",
  },
  {
    id: "thoughts",
    title: "Random Thoughts",
    category: "Idea",
    emoji: "☁️",
    background: "#DCEBFF",
    content: "Random Thoughts\n\nWhat's on my mind?\n\n\nIdeas to explore:\n",
  },
  {
    id: "story",
    title: "Story Ideas",
    category: "Idea",
    emoji: "📚",
    background: "#E8F0D9",
    content:
      "Story Ideas\n\nTitle:\nCharacters:\nSetting:\n\nPlot idea:\n\nOpening scene:\n",
  },
  {
    id: "writing",
    title: "Writing Ideas",
    category: "Idea",
    emoji: "✍️",
    background: "#FFE9C7",
    content:
      "Writing Ideas\n\nTopic:\n\nMain message:\n\nKey points:\n☐ Point 1\n☐ Point 2\n☐ Point 3\n\nDraft:\n",
  },
  {
    id: "song",
    title: "Songwriting Ideas",
    category: "Idea",
    emoji: "🎵",
    background: "#D5F4F0",
    content:
      "Songwriting Ideas\n\nSong title:\nMood:\n\nVerse:\n\nChorus:\n\nMelody ideas:\n",
  },
  {
    id: "recipe",
    title: "Recipe Ideas",
    category: "Idea",
    emoji: "🍅",
    background: "#E8F0DC",
    content:
      "Recipe Ideas\n\nRecipe name:\n\nIngredients\n☐\n☐\n☐\n\nInstructions:\n1.\n2.\n3.\n",
  },
];

const defaultBackgrounds = [
  {
    id: "flowers",
    title: "Soft Flowers",
    uri: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=900&auto=format&fit=crop&q=85",
  },
  {
    id: "nature",
    title: "Green Nature",
    uri: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=900&auto=format&fit=crop&q=85",
  },
  {
    id: "ocean",
    title: "Ocean Blue",
    uri: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=85",
  },
  {
    id: "mountains",
    title: "Mountain View",
    uri: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&auto=format&fit=crop&q=85",
  },
  {
    id: "leaves",
    title: "Tropical Leaves",
    uri: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=900&auto=format&fit=crop&q=85",
  },
  {
    id: "sunset",
    title: "Warm Sunset",
    uri: "https://images.unsplash.com/photo-1472120435266-53107fd0c44a?w=900&auto=format&fit=crop&q=85",
  },
  {
    id: "clouds",
    title: "Sky & Clouds",
    uri: "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?w=900&auto=format&fit=crop&q=85",
  },
  {
    id: "wood",
    title: "Natural Texture",
    uri: "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=900&auto=format&fit=crop&q=85",
  },
];

export default function NoteTemplatesScreen() {
  const [activeCategory, setActiveCategory] =
    useState<TemplateCategory>("List");
  const [searchQuery, setSearchQuery] = useState("");
  const [customBackgroundUri, setCustomBackgroundUri] = useState<string | null>(
    null,
  );
  const [selectedDefaultBackground, setSelectedDefaultBackground] = useState<
    string | null
  >(null);

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;
  const isWideDesktop = Platform.OS === "web" && width >= 1400;
  const contentWidth = Math.min(width, isWideDesktop ? 1480 : 1180);
  const gridColumns = width >= 1400 ? 4 : width >= 900 ? 3 : 2;
  const gridGap = isDesktop ? 20 : 15;
  const gridHorizontalPadding = isDesktop ? 28 : 20;
  const cardWidth =
    (contentWidth - gridHorizontalPadding * 2 - gridGap * (gridColumns - 1)) /
    gridColumns;

  const filteredTemplates = useMemo(() => {
    const base =
      activeCategory === "Recent"
        ? templates.slice(0, 8)
        : activeCategory === "Custom"
          ? []
          : templates.filter((item) => item.category === activeCategory);

    const query = searchQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [activeCategory, searchQuery]);

  const chooseBackgroundFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Gallery permission required",
          "Allow photo library access to choose a background image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.9,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setCustomBackgroundUri(result.assets[0].uri);
        setSelectedDefaultBackground(null);
      }
    } catch (error) {
      console.error("Failed to choose note background:", error);
      Alert.alert("Unable to open gallery", "Please try again.");
    }
  };

  const useCustomBackground = () => {
    const backgroundUri = customBackgroundUri || selectedDefaultBackground;
    if (!backgroundUri) {
      Alert.alert(
        "Choose a background",
        "Select one of the default images or choose a photo from your gallery.",
      );
      return;
    }

    router.push({
      pathname: "/cretenote",
      params: {
        quickNote: "true",
        templateId: "custom-gallery-background",
        templateTitle: "Custom Note",
        templateContent: "",
        templateBackground: backgroundUri,
        templateBackgroundType: "image",
        templateCategory: "Custom",
      },
    });
  };

  const selectTemplate = (template: NoteTemplate) => {
    router.replace({
      pathname: "/cretenote",
      params: {
        quickNote: "true",
        templateTitle: template.title,
        templateContent: template.content,
        templateBackground: template.background,
        templateCategory: template.category,
        templateId: template.id,
      },
    });
  };

  return (
    <View style={[styles.screen, isDesktop && styles.desktopScreen]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3FAF6" />

      <View style={[styles.header, isDesktop && styles.desktopHeader]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#173B30" />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>YOUR CREATIVE SPACE</Text>
          <Text style={styles.headerTitle}>Note templates</Text>
          <Text style={styles.headerSubtitle}>
            A beautiful starting point for every thought.
          </Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="leaf-outline" size={24} color="#16845F" />
        </View>
      </View>

      <View style={[styles.searchBox, isDesktop && styles.desktopSearchBox]}>
        <Ionicons name="search-outline" size={20} color="#729084" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search templates..."
          placeholderTextColor="#8DA69A"
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search note templates"
        />
        {!!searchQuery && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={19} color="#8DA69A" />
          </Pressable>
        )}
      </View>

      <View
        style={[styles.sectionIntro, isDesktop && styles.desktopSectionIntro]}
      >
        <View>
          <Text style={styles.sectionTitle}>Explore templates</Text>
          <Text style={styles.sectionSubTitle}>
            Pick one and start creating
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>
            {activeCategory === "Custom"
              ? "Custom"
              : `${filteredTemplates.length} layouts`}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.categoryList,
          isDesktop && styles.desktopCategoryList,
        ]}
      >
        {categories.map((category) => {
          const selected = category === activeCategory;

          return (
            <Pressable
              key={category}
              onPress={() => setActiveCategory(category)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.categoryButton,
                selected && styles.categoryButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selected && styles.categoryTextActive,
                ]}
              >
                {category}
              </Text>

              {selected && <View style={styles.activeLine} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.grid, isDesktop && styles.desktopGrid]}
      >
        {activeCategory === "Custom" ? (
          <View
            style={[
              styles.customContainer,
              isDesktop && styles.desktopCustomContainer,
            ]}
          >
            <View style={styles.customIntro}>
              <View style={styles.customIcon}>
                <Ionicons name="image-outline" size={28} color="#16845F" />
              </View>
              <Text style={styles.customTitle}>Create your own background</Text>
              <Text style={styles.customDescription}>
                Pick a ready-made background below, or choose your own photo
                from the gallery.
              </Text>
            </View>

            <Text style={styles.sectionHeading}>Default backgrounds</Text>
            <View style={styles.backgroundPresetGrid}>
              {defaultBackgrounds.map((background) => {
                const selected = selectedDefaultBackground === background.uri;
                return (
                  <Pressable
                    key={background.id}
                    onPress={() => {
                      setSelectedDefaultBackground(background.uri);
                      setCustomBackgroundUri(null);
                    }}
                    style={[
                      styles.backgroundPresetCard,
                      isDesktop && {
                        width: gridColumns >= 4 ? "23.5%" : "31.5%",
                      },
                      selected && styles.backgroundPresetCardSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${background.title} background`}
                  >
                    <Image
                      source={{ uri: background.uri }}
                      style={[
                        styles.backgroundPresetImage,
                        isDesktop && { height: 150 },
                      ]}
                      resizeMode="cover"
                    />
                    {selected && (
                      <View style={styles.presetSelectedBadge}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    )}
                    <Text
                      style={styles.backgroundPresetTitle}
                      numberOfLines={1}
                    >
                      {background.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionHeading}>Or use your own photo</Text>
            <Pressable
              onPress={() => void chooseBackgroundFromGallery()}
              style={styles.galleryPicker}
              accessibilityRole="button"
              accessibilityLabel="Choose a background image from gallery"
            >
              {customBackgroundUri || selectedDefaultBackground ? (
                <Image
                  source={{
                    uri:
                      customBackgroundUri ||
                      selectedDefaultBackground ||
                      undefined,
                  }}
                  style={styles.customImagePreview}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.galleryPlaceholder}>
                  <View style={styles.galleryIconCircle}>
                    <Ionicons name="images-outline" size={30} color="#16845F" />
                  </View>
                  <Text style={styles.galleryTitle}>Choose from Gallery</Text>
                  <Text style={styles.gallerySubtitle}>
                    JPG, PNG or photos on your device
                  </Text>
                </View>
              )}
              <View style={styles.changeImageBadge}>
                <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
                <Text style={styles.changeImageText}>
                  {customBackgroundUri || selectedDefaultBackground
                    ? "Change image"
                    : "Browse photos"}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={useCustomBackground}
              style={[
                styles.useBackgroundButton,
                !(customBackgroundUri || selectedDefaultBackground) &&
                  styles.useBackgroundButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Create note with selected background"
            >
              <Ionicons
                name="document-text-outline"
                size={19}
                color="#FFFFFF"
              />
              <Text style={styles.useBackgroundButtonText}>
                Use Background & Create Note
              </Text>
            </Pressable>
          </View>
        ) : filteredTemplates.length > 0 ? (
          <View style={styles.gridRowContainer}>
            {filteredTemplates.map((template) => (
              <Pressable
                key={template.id}
                onPress={() => selectTemplate(template)}
                style={[
                  styles.templateCard,
                  { width: cardWidth },
                  isDesktop && styles.desktopTemplateCard,
                ]}
              >
                <View
                  style={[
                    styles.templateArtwork,
                    { backgroundColor: template.background },
                    isDesktop && styles.desktopTemplateArtwork,
                  ]}
                >
                  <View style={styles.artworkDecoration}>
                    <View style={styles.emojiBadge}>
                      <Text style={styles.artworkEmoji}>{template.emoji}</Text>
                    </View>
                    <View style={styles.paperPreview}>
                      <View style={styles.paperTopDot} />
                      <View style={styles.paperLine} />
                      <View style={styles.paperLineShort} />
                      <View style={styles.paperLine} />
                      <View style={styles.paperLineShort} />
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.cardCaption,
                    isDesktop && styles.desktopCardCaption,
                  ]}
                >
                  <Text
                    style={[
                      styles.templateTitle,
                      isDesktop && styles.desktopTemplateTitle,
                    ]}
                    numberOfLines={2}
                  >
                    {template.title}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>No templates found</Text>
            <Text style={styles.emptyDescription}>
              Choose another category to explore note templates.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopScreen: {
    alignItems: "center",
  },
  desktopHeader: {
    width: "100%",
    maxWidth: 1480,
    minHeight: 154,
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 22,
  },
  desktopSearchBox: {
    width: "100%",
    maxWidth: 1424,
    alignSelf: "center",
    minHeight: 58,
    marginHorizontal: 0,
    marginTop: 4,
    marginBottom: 28,
    borderRadius: 16,
    paddingHorizontal: 20,
    borderColor: "#DCECE2",
    shadowOpacity: 0.045,
    shadowRadius: 16,
  },
  desktopSectionIntro: {
    width: "100%",
    maxWidth: 1424,
    paddingHorizontal: 0,
    marginBottom: 14,
  },
  desktopCategoryList: {
    width: "100%",
    maxWidth: 1424,
    alignSelf: "center",
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 10,
  },
  desktopGrid: {
    width: "100%",
    maxWidth: 1480,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 56,
  },
  desktopTemplateCard: {
    borderRadius: 20,
    marginBottom: 0,
    shadowOpacity: 0.055,
    shadowRadius: 16,
    elevation: 2,
  },
  desktopTemplateArtwork: {
    height: 184,
  },
  desktopCardCaption: {
    minHeight: 76,
    paddingHorizontal: 17,
    paddingVertical: 15,
  },
  desktopTemplateTitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  desktopCustomContainer: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingTop: 20,
  },
  screen: {
    flex: 1,
    backgroundColor: "#F3FAF6",
  },
  header: {
    minHeight: 122,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#E4F3EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  headerCopy: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  headerEyebrow: {
    color: "#39896B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerTitle: {
    color: "#173B30",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  headerSubtitle: {
    color: "#718C7E",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#DDF3E6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  searchBox: {
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 20,
    minHeight: 52,
    borderRadius: 17,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0EEE5",
    shadowColor: "#24543D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    color: "#173B30",
    fontSize: 14,
    paddingVertical: 10,
  },
  sectionIntro: {
    paddingHorizontal: 20,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#173B30",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionSubTitle: {
    color: "#7A9587",
    fontSize: 12,
    marginTop: 4,
  },
  countPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#E2F4E9",
  },
  countPillText: {
    color: "#287653",
    fontSize: 11,
    fontWeight: "800",
  },

  categoryList: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 14,
    alignItems: "center",
    gap: 4,
  },

  categoryButton: {
    minWidth: 76,
    height: 43,
    paddingHorizontal: 13,
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E3EEE7",
    backgroundColor: "#FFFFFF",
  },
  categoryButtonActive: {
    backgroundColor: "#DDF3E6",
    borderColor: "#B7E4C9",
  },
  categoryText: {
    color: "#6E897A",
    fontSize: 15,
    fontWeight: "600",
  },
  categoryTextActive: {
    color: "#176747",
    fontWeight: "800",
  },
  activeLine: {
    position: "absolute",
    bottom: -1,
    width: 24,
    height: 3,
    borderRadius: 4,
    backgroundColor: "#279B6B",
  },
  grid: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 36,
  },
  gridRowContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 15,
  },
  templateCard: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    marginBottom: 1,
    borderWidth: 1,
    borderColor: "#E3EEE7",
    shadowColor: "#24543D",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.065,
    shadowRadius: 12,
    elevation: 3,
  },
  templateArtwork: {
    height: 146,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  artworkDecoration: {
    width: "84%",
    height: "82%",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  emojiBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.58)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  artworkEmoji: {
    fontSize: 42,
  },
  paperPreview: {
    width: "44%",
    height: "75%",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingTop: 16,
    gap: 8,
    backgroundColor: "#FFFEFA",
    transform: [{ rotate: "5deg" }],
    shadowColor: "#1B3445",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  paperTopDot: {
    width: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: "#F3C96B",
    marginBottom: 1,
  },
  paperLine: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "#D5DFE5",
    width: "100%",
  },
  paperLineShort: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "#B7DCD0",
    width: "65%",
  },
  cardCaption: {
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "flex-start",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  templateTitle: {
    color: "#193D30",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "left",
    lineHeight: 20,
  },
  customContainer: {
    paddingTop: 12,
    paddingBottom: 30,
  },
  sectionHeading: {
    color: "#183744",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 4,
  },
  backgroundPresetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 24,
  },
  backgroundPresetCard: {
    width: "48.5%",
    borderRadius: 15,
    padding: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7ECE9",
    overflow: "hidden",
  },
  backgroundPresetCardSelected: {
    borderColor: "#16845F",
    backgroundColor: "#E8F7F2",
  },
  backgroundPresetImage: {
    width: "100%",
    height: 112,
    borderRadius: 10,
    backgroundColor: "#E8EFEC",
  },
  backgroundPresetTitle: {
    color: "#25404A",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 5,
    paddingVertical: 9,
  },
  presetSelectedBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16845F",
  },
  customIntro: {
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 22,
  },
  customIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#E2F5EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  customTitle: {
    color: "#193D30",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  customDescription: {
    color: "#718C7E",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  galleryPicker: {
    height: 300,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#B8DED5",
    borderStyle: "dashed",
    backgroundColor: "#F2FAF7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  customImagePreview: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  galleryPlaceholder: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  galleryIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#DFF3EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  galleryTitle: {
    color: "#163A42",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  gallerySubtitle: {
    color: "#718087",
    fontSize: 12,
    textAlign: "center",
  },
  changeImageBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(16, 43, 58, 0.88)",
  },
  changeImageText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  useBackgroundButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#16845F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  useBackgroundButtonDisabled: {
    backgroundColor: "#7ABDB3",
  },
  useBackgroundButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 90,
    paddingHorizontal: 28,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#193D30",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyDescription: {
    color: "#718C7E",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
