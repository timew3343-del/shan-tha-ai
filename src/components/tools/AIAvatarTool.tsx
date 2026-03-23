import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToolOutput } from '@/hooks/useToolOutput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  prompt: z.string().min(1, { message: 'Avatar prompt is required.' }).max(1000, { message: 'Prompt too long.' }),
  gender: z.string().optional(),
  age: z.string().optional(),
  ethnicity: z.string().optional(),
});

type AvatarFormValues = z.infer<typeof formSchema>;

export default function AIAvatarTool() {
  const { saveOutput } = useToolOutput("ai-avatar", "AI Avatar");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AvatarFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
      gender: 'neutral', // Default gender
      age: 'adult', // Default age
      ethnicity: 'diverse', // Default ethnicity
    },
  });

  const onSubmit = async (values: AvatarFormValues) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('You need to be logged in to use this tool.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-avatar', {
        body: JSON.stringify({
          prompt: values.prompt,
          gender: values.gender,
          age: values.age,
          ethnicity: values.ethnicity,
        }),
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast.error(error.message);
        console.error('Avatar generation error:', error);
      } else if (data && data.success) {
        toast.success('Avatar generated successfully!');
        addOutput({
          tool: 'AI Avatar Generation',
          type: 'image',
          content: data.avatarUrl,
          metadata: { prompt: values.prompt, gender: values.gender, age: values.age, ethnicity: values.ethnicity, creditsUsed: data.creditsUsed },
          timestamp: new Date().toISOString(),
        });
      } else {
        toast.error(data?.error || 'Failed to generate avatar.');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
      console.error('Avatar generation catch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Avatar Generation Tool</CardTitle>
        <CardDescription>စာသားမှ AI Avatar များ ဖန်တီးပါ။</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar Prompt</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ဥပမာ- ရယ်မောနေသော အမျိုးသမီးတစ်ဦး၊ ကာတွန်းပုံစံ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ကျား/မ ရွေးပါ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">ကျား</SelectItem>
                      <SelectItem value="female">မ</SelectItem>
                      <SelectItem value="neutral">ကျား/မ မဟုတ်</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="အသက်အပိုင်းအခြား ရွေးပါ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="child">ကလေး</SelectItem>
                      <SelectItem value="teen">ဆယ်ကျော်သက်</SelectItem>
                      <SelectItem value="adult">လူကြီး</SelectItem>
                      <SelectItem value="elderly">သက်ကြီးရွယ်အို</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ethnicity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ethnicity</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="လူမျိုးနွယ်စု ရွေးပါ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="asian">အာရှ</SelectItem>
                      <SelectItem value="caucasian">ကော့ကေးဆပ်</SelectItem>
                      <SelectItem value="african">အာဖရိက</SelectItem>
                      <SelectItem value="hispanic">ဟစ်စပန်းနစ်</SelectItem>
                      <SelectItem value="diverse">မျိုးစုံ</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Avatar ထုတ်လုပ်ရန်'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">AI Avatar Generation Tool သည် သင်၏ prompt အပေါ်မူတည်၍ Avatar များကို ဖန်တီးပေးပါသည်။</p>
      </CardFooter>
    </Card>
  );
}
